import SwiftUI
import HealthKit
import CoreLocation

/// Reads only samples explicitly associated with the selected exercise.
final class WorkoutResultsReader {
    let store = HKHealthStore()
    let quantities: [HKQuantityType] = [
        "heartRate", "heartRateVariabilitySDNN", "restingHeartRate", "walkingHeartRateAverage",
        "activeEnergyBurned", "basalEnergyBurned", "distanceWalkingRunning", "distanceCycling",
        "distanceSwimming", "distanceWheelchair", "stepCount", "flightsClimbed", "runningSpeed",
        "runningPower", "runningStrideLength", "runningVerticalOscillation", "runningGroundContactTime",
        "walkingSpeed", "walkingStepLength", "walkingDoubleSupportPercentage", "walkingAsymmetryPercentage",
        "oxygenSaturation", "respiratoryRate", "vo2Max", "swimmingStrokeCount",
        "cyclingSpeed", "cyclingPower", "cyclingCadence", "cyclingFunctionalThresholdPower",
        "physicalEffort", "workoutEffortScore", "estimatedWorkoutEffortScore", "distanceDownhillSnowSports", "distanceCrossCountrySkiing",
        "distancePaddleSports", "distanceRowing", "distanceSkatingSports", "crossCountrySkiingSpeed",
        "paddleSportsSpeed", "rowingSpeed", "underwaterDepth", "waterTemperature", "pushCount",
        "heartRateRecoveryOneMinute", "stairAscentSpeed", "stairDescentSpeed"
    ].compactMap { name in
        HKObjectType.quantityType(forIdentifier: HKQuantityTypeIdentifier(rawValue: "HKQuantityTypeIdentifier" + name.prefix(1).uppercased() + name.dropFirst()))
    }

    func authorize() async throws {
        guard HKHealthStore.isHealthDataAvailable() else {
            throw NSError(domain: "Foulee", code: 1, userInfo: [NSLocalizedDescriptionKey: "Santé n’est pas disponible sur cet appareil."])
        }
        var types = Set<HKObjectType>(quantities)
        types.insert(HKObjectType.workoutType())
        types.insert(HKSeriesType.workoutRoute())
        try await store.requestAuthorization(toShare: [], read: types)
    }

    func samples(_ type: HKSampleType, predicate: NSPredicate? = nil) async throws -> [HKSample] {
        try await withCheckedThrowingContinuation { continuation in
            store.execute(HKSampleQuery(sampleType: type, predicate: predicate, limit: HKObjectQueryNoLimit,
                sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: samples ?? []) }
            })
        }
    }

    func workouts() async throws -> [HKWorkout] {
        try await samples(.workoutType()) as? [HKWorkout] ?? []
    }

    private func units(for types: Set<HKQuantityType>) async throws -> [HKQuantityType: HKUnit] {
        try await withCheckedThrowingContinuation { continuation in
            store.preferredUnits(for: types) { units, error in
                if let error { continuation.resume(throwing: error) }
                else { continuation.resume(returning: units) }
            }
        }
    }

    private func jsonValue(_ value: Any) -> Any {
        switch value {
        case let date as Date: return ISO8601DateFormatter().string(from: date)
        case let quantity as HKQuantity: return quantity.description
        case let dictionary as [String: Any]: return dictionary.mapValues(jsonValue)
        case let array as [Any]: return array.map(jsonValue)
        case let string as String: return string
        case let number as NSNumber: return number
        case let uuid as UUID: return uuid.uuidString
        default: return String(describing: value)
        }
    }

    private func base(_ object: HKObject) -> [String: Any] {
        var result: [String: Any] = [
            "uuid": object.uuid.uuidString,
            "metadata": jsonValue(object.metadata ?? [:]),
            "source": ["name": object.sourceRevision.source.name,
                       "bundleIdentifier": object.sourceRevision.source.bundleIdentifier,
                       "version": object.sourceRevision.version ?? "",
                       "productType": object.sourceRevision.productType ?? "",
                       "operatingSystemVersion": "\(object.sourceRevision.operatingSystemVersion.majorVersion).\(object.sourceRevision.operatingSystemVersion.minorVersion).\(object.sourceRevision.operatingSystemVersion.patchVersion)"]
        ]
        if let device = object.device {
            result["device"] = ["name": device.name ?? "", "manufacturer": device.manufacturer ?? "",
                "model": device.model ?? "", "hardwareVersion": device.hardwareVersion ?? "",
                "softwareVersion": device.softwareVersion ?? "", "firmwareVersion": device.firmwareVersion ?? "",
                "localIdentifier": device.localIdentifier ?? ""]
        }
        return result
    }

    private func timestamp(_ date: Date) -> String { ISO8601DateFormatter().string(from: date) }

    private func statistics(_ values: [HKQuantityType: HKStatistics], units: [HKQuantityType: HKUnit]) -> [[String: Any]] {
        values.sorted { $0.key.identifier < $1.key.identifier }.map { type, stats in
            var result: [String: Any] = ["identifier": type.identifier,
                "startDate": timestamp(stats.startDate), "endDate": timestamp(stats.endDate)]
            if let unit = units[type] {
                result["unit"] = unit.unitString
                for (key, quantity) in [("sum", stats.sumQuantity()), ("average", stats.averageQuantity()),
                    ("minimum", stats.minimumQuantity()), ("maximum", stats.maximumQuantity()), ("mostRecent", stats.mostRecentQuantity())] {
                    if let quantity { result[key] = quantity.doubleValue(for: unit) }
                }
            }
            return result
        }
    }

    private func locations(_ route: HKWorkoutRoute) async throws -> [[String: Any]] {
        try await withCheckedThrowingContinuation { continuation in
            var points: [[String: Any]] = []
            store.execute(HKWorkoutRouteQuery(route: route) { _, locations, done, error in
                if let error { continuation.resume(throwing: error); return }
                points.append(contentsOf: (locations ?? []).map { location in
                    ["timestamp": ISO8601DateFormatter().string(from: location.timestamp), "latitude": location.coordinate.latitude,
                     "longitude": location.coordinate.longitude, "altitudeMeters": location.altitude,
                     "horizontalAccuracyMeters": location.horizontalAccuracy, "verticalAccuracyMeters": location.verticalAccuracy,
                     "speedMetersPerSecond": location.speed, "speedAccuracy": location.speedAccuracy,
                     "courseDegrees": location.course, "courseAccuracy": location.courseAccuracy]
                })
                if done { continuation.resume(returning: points) }
            })
        }
    }

    func export(_ workout: HKWorkout, plan: WatchWorkoutFile?) async throws -> Data {
        let types = workout.workoutActivities.reduce(Set(quantities).union(workout.allStatistics.keys)) {
            $0.union($1.allStatistics.keys)
        }
        // A workout can include quantities beyond the common exercise metrics.
        try await store.requestAuthorization(toShare: [], read: Set<HKObjectType>(types))
        let preferred = try await units(for: types)
        let predicate = HKQuery.predicateForObjects(from: workout)
        var warnings: [String] = []
        var measurements: [[String: Any]] = []
        for type in types.sorted(by: { $0.identifier < $1.identifier }) {
            do {
                let values = try await samples(type, predicate: predicate)
                for case let sample as HKQuantitySample in values {
                    var value = base(sample)
                    value["identifier"] = type.identifier
                    value["startDate"] = timestamp(sample.startDate)
                    value["endDate"] = timestamp(sample.endDate)
                    if let unit = preferred[type] {
                        value["value"] = sample.quantity.doubleValue(for: unit)
                        value["unit"] = unit.unitString
                    } else { value["quantity"] = sample.quantity.description }
                    measurements.append(value)
                }
            } catch { warnings.append("\(type.identifier) : \(error.localizedDescription)") }
        }
        var routes: [[String: Any]] = []
        do {
            for case let route as HKWorkoutRoute in try await samples(HKSeriesType.workoutRoute(), predicate: predicate) {
                var value = base(route)
                do { value["points"] = try await locations(route) }
                catch { warnings.append("Parcours \(route.uuid) : \(error.localizedDescription)") }
                routes.append(value)
            }
        } catch { warnings.append("Parcours : \(error.localizedDescription)") }
        var detail = base(workout)
        detail["activityType"] = workout.workoutActivityType.rawValue
        detail["startDate"] = timestamp(workout.startDate)
        detail["endDate"] = timestamp(workout.endDate)
        detail["durationSeconds"] = workout.duration
        detail["elapsedSeconds"] = workout.endDate.timeIntervalSince(workout.startDate)
        detail["statistics"] = statistics(workout.allStatistics, units: preferred)
        detail["events"] = (workout.workoutEvents ?? []).map { event -> [String: Any] in
            ["type": event.type.rawValue, "startDate": timestamp(event.dateInterval.start),
             "endDate": timestamp(event.dateInterval.end), "metadata": jsonValue(event.metadata ?? [:])]
        }
        detail["activities"] = workout.workoutActivities.map { activity -> [String: Any] in
            ["uuid": activity.uuid.uuidString, "activityType": activity.workoutConfiguration.activityType.rawValue,
             "locationType": activity.workoutConfiguration.locationType.rawValue,
             "startDate": timestamp(activity.startDate), "endDate": activity.endDate.map(timestamp) ?? "",
             "durationSeconds": activity.duration, "metadata": jsonValue(activity.metadata ?? [:]),
             "statistics": statistics(activity.allStatistics, units: preferred)]
        }
        detail["samples"] = measurements
        detail["routes"] = routes
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        var result: [String: Any] = ["date": formatter.string(from: workout.startDate),
            "durationMin": workout.duration / 60, "healthWorkoutId": workout.uuid.uuidString, "healthKit": detail]
        if let distance = workout.totalDistance {
            let km = distance.doubleValue(for: .meter()) / 1000
            result["distanceKm"] = km
            if km > 0 {
                let seconds = Int(workout.duration / km)
                result["averagePace"] = "\(seconds / 60):\(String(format: "%02d", seconds % 60))"
            }
        }
        if let energy = workout.totalEnergyBurned { detail["totalEnergyKilocalories"] = energy.doubleValue(for: .kilocalorie()) }
        if let distance = workout.totalDistance { detail["totalDistanceMeters"] = distance.doubleValue(for: .meter()) }
        result["healthKit"] = detail
        if let plan { result["workoutId"] = plan.workoutId ?? "" }
        let payload: [String: Any] = ["format": "foulee-results-v1", "detailVersion": 1,
            "athleteId": plan?.athleteId ?? "", "athleteName": plan?.athleteName ?? "",
            "exportedAt": timestamp(Date()), "results": [result], "warnings": warnings,
            "availabilityNote": "Seules les données lisibles et associées à cet exercice sont exportées. Santé ne distingue pas une donnée absente d’une autorisation de lecture refusée."]
        return try JSONSerialization.data(withJSONObject: payload, options: [.prettyPrinted, .sortedKeys])
    }
}

struct WorkoutResultsExportView: View {
    let plan: WatchWorkoutFile?
    @State private var workouts: [HKWorkout] = []
    @State private var selectedID: UUID?
    @State private var linkToPlan = false
    @State private var busy = false
    @State private var message: String?
    @State private var exporting = false
    @State private var document = ResultsJSONDocument(data: Data())
    private let reader = WorkoutResultsReader()

    var body: some View {
        List {
            Section {
                Text("Choisis un exercice enregistré dans Santé, puis exporte ses résultats et ses données détaillées en JSON.")
                Text("L’export peut contenir le parcours GPS et des données de santé. Seules les mesures autorisées et disponibles sont incluses.")
                    .font(.footnote).foregroundStyle(.secondary)
                Button("Charger les exercices depuis Santé", systemImage: "heart.text.square") { load() }
                    .disabled(busy)
            }
            if busy { ProgressView("Lecture de Santé…") }
            if let message { Text(message).font(.footnote) }
            if !workouts.isEmpty {
                Section("Choisir l’exercice (\(workouts.count))") {
                    ForEach(workouts, id: \.uuid) { workout in
                        Button { selectedID = workout.uuid } label: {
                            HStack {
                                VStack(alignment: .leading, spacing: 5) {
                                    Text(activityName(workout)).font(.headline)
                                    Text(workout.startDate.formatted(date: .abbreviated, time: .shortened))
                                    Text("\(Int(workout.duration / 60)) min · \(workout.sourceRevision.source.name)")
                                        .font(.caption).foregroundStyle(.secondary)
                                    if let distance = workout.totalDistance {
                                        Text("\((distance.doubleValue(for: .meter()) / 1000).formatted(.number.precision(.fractionLength(2)))) km").font(.caption)
                                    }
                                }
                                Spacer()
                                if selectedID == workout.uuid { Image(systemName: "checkmark.circle.fill") }
                            }.foregroundStyle(.primary)
                        }.disabled(busy)
                    }
                }
            }
            Section {
                if let plan {
                    Toggle("Rattacher à la séance « \(plan.name) » de \(plan.athleteName ?? "Foulée")", isOn: $linkToPlan)
                        .disabled(busy)
                }
                Button("Exporter l’exercice choisi", systemImage: "square.and.arrow.up") { export() }
                    .disabled(busy || selectedID == nil)
            }
        }
        .navigationTitle("Exporter les résultats")
        .fileExporter(isPresented: $exporting, document: document, contentType: .json,
                      defaultFilename: "foulee-resultat-\(selectedID?.uuidString ?? "exercice")") { result in
            switch result {
            case .success: message = "Fichier exporté."
            case .failure(let error): message = "Export impossible : \(error.localizedDescription)"
            }
        }
    }

    private func activityName(_ workout: HKWorkout) -> String {
        switch workout.workoutActivityType {
        case .running: return "Course à pied"
        case .walking: return "Marche"
        case .cycling: return "Vélo"
        case .swimming: return "Natation"
        case .hiking: return "Randonnée"
        case .traditionalStrengthTraining, .functionalStrengthTraining: return "Renforcement"
        case .yoga: return "Yoga"
        default: return "Exercice (type \(workout.workoutActivityType.rawValue))"
        }
    }

    private func load() {
        busy = true
        message = nil
        Task { @MainActor in
            defer { busy = false }
            do {
                try await reader.authorize()
                workouts = try await reader.workouts()
                if !workouts.contains(where: { $0.uuid == selectedID }) { selectedID = nil }
                message = workouts.isEmpty ? "Aucun exercice lisible. Vérifie les autorisations Santé et la synchronisation de la montre." : nil
            } catch { message = error.localizedDescription }
        }
    }

    private func export() {
        guard let workout = workouts.first(where: { $0.uuid == selectedID }) else { return }
        busy = true
        message = "Collecte des mesures et du parcours…"
        Task { @MainActor in
            defer { busy = false }
            do {
                document = ResultsJSONDocument(data: try await reader.export(workout, plan: linkToPlan ? plan : nil))
                message = "Données collectées. Choisis où enregistrer le fichier."
                exporting = true
            } catch { message = "Collecte impossible : \(error.localizedDescription)" }
        }
    }
}
