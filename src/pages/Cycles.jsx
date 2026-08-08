const cycleDays = [
  {
    day: 'Day 1',
    periods: [
      { period: 1, time: '7:45 – 8:35', course: 'English 12' },
      { period: 2, time: '8:40 – 9:30', course: 'AP Calculus' },
      { period: 3, time: '9:35 – 10:25', course: 'Physics' },
      { period: 4, time: '10:30 – 11:20', course: 'US Government' },
      { period: 5, time: '11:25 – 12:15', course: 'Lunch / Study Hall' },
      { period: 6, time: '12:20 – 1:10', course: 'Spanish IV' },
      { period: 7, time: '1:15 – 2:05', course: 'Senior Seminar' },
      { period: 8, time: '2:10 – 3:00', course: 'Elective' },
    ],
  },
  {
    day: 'Day 2',
    periods: [
      { period: 1, time: '7:45 – 8:35', course: 'AP Calculus' },
      { period: 2, time: '8:40 – 9:30', course: 'Physics Lab' },
      { period: 3, time: '9:35 – 10:25', course: 'English 12' },
      { period: 4, time: '10:30 – 11:20', course: 'Spanish IV' },
      { period: 5, time: '11:25 – 12:15', course: 'Lunch / Study Hall' },
      { period: 6, time: '12:20 – 1:10', course: 'US Government' },
      { period: 7, time: '1:15 – 2:05', course: 'Elective' },
      { period: 8, time: '2:10 – 3:00', course: 'Senior Seminar' },
    ],
  },
]

export default function Cycles() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">Daily Class Cycle</h2>
        <p className="mt-1 text-slate-600">
          Our school runs a two-day rotating schedule. Check which cycle day today is on the
          morning announcements board.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {cycleDays.map(({ day, periods }) => (
          <div key={day} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
              <h3 className="font-semibold text-slate-900">{day}</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-slate-500">
                    <th className="px-4 py-2 font-medium">Period</th>
                    <th className="px-4 py-2 font-medium">Time</th>
                    <th className="px-4 py-2 font-medium">Class</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((row) => (
                    <tr key={row.period} className="border-b border-slate-50 last:border-0">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{row.period}</td>
                      <td className="px-4 py-2.5 text-slate-600">{row.time}</td>
                      <td className="px-4 py-2.5 text-slate-800">{row.course}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
