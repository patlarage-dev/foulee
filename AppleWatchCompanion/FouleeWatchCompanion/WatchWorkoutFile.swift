import Foundation
import HealthKit
import WorkoutKit

struct WatchWorkoutFile: Decodable, Identifiable {
    let format: String
    let athleteId: String?
    let athleteName: String?
    let workoutId: String?
    let name: String
    let target: String
    let scheduledDate: String
    let durationMin: Double
    let structure: WorkoutStructure
    let phases: [WorkoutPhase]?

    var id: String { "\(name)-\(scheduledDate)" }

    var hasValidPhases: Bool {
        guard let phases, !phases.isEmpty else { return true }
        return Set(phases.map(\.id)).count == phases.count
            && phases.allSatisfy { !$0.id.isEmpty && !$0.name.isEmpty && $0.seconds.isFinite && $0.seconds >= 1 }
            && abs(phases.reduce(0) { $0 + $1.seconds } - durationMin * 60) < 1
    }

    var scheduledDay: Date {
        let formatter = DateFormatter()
        formatter.calendar = Calendar(identifier: .gregorian)
        formatter.locale = Locale(identifier: "en_US_POSIX")
        formatter.dateFormat = "yyyy-MM-dd"
        return formatter.date(from: scheduledDate) ?? Date()
    }

    func makeWorkoutPlan() -> WorkoutPlan {
        let warmup = structure.warmupMin > 0 ? step(minutes: structure.warmupMin) : nil
        let cooldown = structure.cooldownMin > 0 ? step(minutes: structure.cooldownMin) : nil
        let workStep = step(minutes: structure.workMin, includesPaceAlert: true)
        let work = IntervalStep(.work, step: workStep)

        var blocks: [IntervalBlock] = []
        let repetitions = max(1, structure.reps)
        if repetitions > 1, structure.recoveryMin > 0 {
            let recovery = IntervalStep(.recovery, step: step(minutes: structure.recoveryMin))
            blocks.append(IntervalBlock(steps: [work, recovery], iterations: repetitions - 1))
            blocks.append(IntervalBlock(steps: [work], iterations: 1))
        } else {
            blocks.append(IntervalBlock(steps: [work], iterations: repetitions))
        }

        if let phases, !phases.isEmpty {
            blocks = phases.map { phase in
                let phaseStep = WorkoutStep(goal: .time(max(1, phase.seconds), .seconds), alert: paceAlert(phase.target))
                return IntervalBlock(steps: [IntervalStep(phase.work == false ? .recovery : .work, step: phaseStep)], iterations: 1)
            }
        }
        let workout = CustomWorkout(
            activity: .running,
            location: .outdoor,
            displayName: String(name.prefix(30)),
            warmup: phases?.isEmpty == false ? nil : warmup,
            blocks: blocks,
            cooldown: phases?.isEmpty == false ? nil : cooldown
        )
        return WorkoutPlan(.custom(workout), id: UUID())
    }

    private func step(minutes: Double, includesPaceAlert: Bool = false) -> WorkoutStep {
        WorkoutStep(
            goal: .time(max(1, minutes * 60), .seconds),
            alert: includesPaceAlert ? paceAlert() : nil
        )
    }

    private func paceAlert(_ phaseTarget: String? = nil) -> SpeedRangeAlert? {
        let paceTarget = phaseTarget ?? target
        guard let range = paceTarget.range(of: #"\d{1,2}[:′’']\d{2}"#, options: .regularExpression) else { return nil }
        let paceText = String(paceTarget[range]).replacingOccurrences(of: "′", with: ":").replacingOccurrences(of: "’", with: ":").replacingOccurrences(of: "'", with: ":")
        let fields = paceText.split(separator: ":").compactMap { Double($0) }
        guard fields.count == 2, fields[1] < 60 else { return nil }
        let secondsPerKilometer = fields[0] * 60 + fields[1]
        guard secondsPerKilometer > 0 else { return nil }
        let metersPerSecond = 1_000 / secondsPerKilometer
        let lower = Measurement(value: metersPerSecond * 0.95, unit: UnitSpeed.metersPerSecond)
        let upper = Measurement(value: metersPerSecond * 1.05, unit: UnitSpeed.metersPerSecond)
        return SpeedRangeAlert(target: lower...upper, metric: .current)
    }
}

struct WorkoutStructure: Decodable {
    let warmupMin: Double
    let reps: Int
    let workMin: Double
    let recoveryMin: Double
    let cooldownMin: Double
}

struct WorkoutPhase: Decodable {
    let id: String
    let name: String
    let seconds: Double
    let target: String?
    let work: Bool?
}
