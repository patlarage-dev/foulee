import SwiftUI
import UniformTypeIdentifiers
import WorkoutKit
import HealthKit

struct ContentView: View {
    @State private var workout: WatchWorkoutFile?
    @State private var scheduledDate = Date()
    @State private var isImporting = false
    @State private var isScheduling = false
    @State private var message: String?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 20) {
                    header
                    NavigationLink {
                        WorkoutResultsExportView(plan: workout)
                    } label: {
                        Label("Exporter les résultats d’un exercice", systemImage: "square.and.arrow.up")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(.borderedProminent)
                    if let workout {
                        workoutCard(workout)
                        DatePicker("Date et heure", selection: $scheduledDate, in: Date()..., displayedComponents: [.date, .hourAndMinute])
                            .datePickerStyle(.compact)
                        Button(action: scheduleWorkout) {
                            HStack {
                                if isScheduling { ProgressView().tint(.white) }
                                Text(isScheduling ? "Programmation…" : "Programmer sur l’Apple Watch")
                            }
                            .frame(maxWidth: .infinity)
                        }
                        .buttonStyle(.borderedProminent)
                        .disabled(isScheduling || !WorkoutScheduler.isSupported)
                    } else {
                        ContentUnavailableView("Aucune séance importée", systemImage: "applewatch", description: Text("Exporte une séance depuis le plan Foulée, puis importe son fichier JSON ici."))
                        Button("Importer une séance Foulée", systemImage: "square.and.arrow.down") { isImporting = true }
                            .buttonStyle(.borderedProminent)
                            .frame(maxWidth: .infinity)
                    }
                    if let message {
                        Text(message)
                            .font(.footnote)
                            .foregroundStyle(.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                    }
                    Text("La séance est envoyée à l’app Exercice de l’Apple Watch. Il faut autoriser Foulée et avoir une montre jumelée.")
                        .font(.footnote)
                        .foregroundStyle(.secondary)
                }
                .padding(20)
            }
            .navigationTitle("Foulée · Apple Watch")
            .toolbar {
                if workout != nil {
                    ToolbarItem(placement: .topBarTrailing) {
                        Button("Importer", systemImage: "square.and.arrow.down") { isImporting = true }
                    }
                }
            }
            .fileImporter(isPresented: $isImporting, allowedContentTypes: [.json], allowsMultipleSelection: false, onCompletion: importFile)

        }
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Tes séances et résultats")
                .font(.largeTitle.weight(.semibold))
            Text("Exporte les résultats d’un exercice depuis Santé, ou importe une séance Foulée pour la programmer sur ta montre.")
                .foregroundStyle(.secondary)
        }
    }

    private func workoutCard(_ item: WatchWorkoutFile) -> some View {
        VStack(alignment: .leading, spacing: 12) {
            Label(item.name, systemImage: "figure.run")
                .font(.title3.weight(.semibold))
            Label("\(item.durationMin.formatted(.number.precision(.fractionLength(0...1)))) min au total", systemImage: "clock")
            Divider()
            if let phases = item.phases, !phases.isEmpty {
                ForEach(phases, id: \.id) { phase in
                    VStack(alignment: .leading, spacing: 4) {
                        detailRow(phase.name, minutes: phase.seconds / 60)
                        if let target = phase.target, !target.isEmpty {
                            Text(target).font(.footnote).foregroundStyle(.secondary)
                        }
                    }
                }
            } else {
                detailRow("Échauffement", minutes: item.structure.warmupMin)
                detailRow("Travail", minutes: item.structure.workMin, prefix: item.structure.reps > 1 ? "\(item.structure.reps) × " : "")
                if item.structure.reps > 1 && item.structure.recoveryMin > 0 {
                    detailRow("Récupération", minutes: item.structure.recoveryMin, suffix: " entre les répétitions")
                }
                detailRow("Retour au calme", minutes: item.structure.cooldownMin)
            }
            if !item.target.isEmpty {
                Text("Consigne : \(item.target)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            if paceIsSupported(item.target) {
                Label("Une plage d’allure cible sera appliquée au travail.", systemImage: "speedometer")
                    .font(.footnote)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(16)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.thinMaterial, in: RoundedRectangle(cornerRadius: 18))
    }

    private func detailRow(_ label: String, minutes: Double, prefix: String = "", suffix: String = "") -> some View {
        HStack {
            Text(label).foregroundStyle(.secondary)
            Spacer()
            Text("\(prefix)\(minutes.formatted(.number.precision(.fractionLength(0...2)))) min\(suffix)")
                .fontWeight(.medium)
        }
        .font(.subheadline)
    }

    private func importFile(_ result: Result<[URL], Error>) {
        do {
            guard let url = try result.get().first else { return }
            let hasAccess = url.startAccessingSecurityScopedResource()
            defer { if hasAccess { url.stopAccessingSecurityScopedResource() } }
            let imported = try JSONDecoder().decode(WatchWorkoutFile.self, from: Data(contentsOf: url))
            guard imported.format == "foulee-watch-workout-v1",
                  imported.durationMin.isFinite, imported.durationMin > 0,
                  imported.hasValidPhases,
                  imported.structure.warmupMin >= 0,
                  imported.structure.reps >= 1,
                  imported.structure.workMin > 0,
                  imported.structure.recoveryMin >= 0,
                  imported.structure.cooldownMin >= 0 else {
                message = "Ce fichier n’est pas un export Apple Watch valide de Foulée."
                return
            }
            workout = imported
            let proposedTime = Calendar.current.date(bySettingHour: 7, minute: 0, second: 0, of: imported.scheduledDay) ?? imported.scheduledDay
            scheduledDate = max(proposedTime, Date().addingTimeInterval(60 * 60))
            message = "Séance importée. Vérifie les blocs et la date avant de la programmer."
        } catch {
            message = "Import impossible : \(error.localizedDescription)"
        }
    }

    private func scheduleWorkout() {
        guard let workout else { return }
        guard WorkoutScheduler.isSupported else {
            message = "La programmation WorkoutKit n’est pas prise en charge sur cet appareil."
            return
        }
        isScheduling = true
        message = nil
        Task {
            let scheduler = WorkoutScheduler.shared
            let authorization = await scheduler.requestAuthorization()
            guard authorization == .authorized else {
                await MainActor.run {
                    message = "Autorisation de programmation refusée ou indisponible."
                    isScheduling = false
                }
                return
            }
            let plan = workout.makeWorkoutPlan()
            let date = Calendar.current.dateComponents([.year, .month, .day, .hour, .minute], from: scheduledDate)
            await scheduler.schedule(plan, at: date)
            await MainActor.run {
                message = "Séance programmée. Elle apparaîtra dans l’app Exercice de l’Apple Watch."
                isScheduling = false
            }
        }
    }

    private func paceIsSupported(_ text: String) -> Bool {
        text.range(of: #"\d{1,2}[:′’']\d{2}"#, options: .regularExpression) != nil
    }
}

struct ResultsJSONDocument: FileDocument {
    static var readableContentTypes: [UTType] { [.json] }
    let data: Data

    init(data: Data) { self.data = data }
    init(configuration: ReadConfiguration) throws { data = configuration.file.regularFileContents ?? Data() }
    func fileWrapper(configuration: WriteConfiguration) throws -> FileWrapper { FileWrapper(regularFileWithContents: data) }
}
