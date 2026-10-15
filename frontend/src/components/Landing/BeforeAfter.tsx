import { CvTemplate } from '../Canvas/CvTemplate';
import { sampleCv } from './sampleCv';

const A4_WIDTH = 794;
const A4_HEIGHT = 1123;

/** "Before": a cramped old-style CV, one dense first-person block. Invented text. */
function OldCv() {
  return (
    <div className="h-full overflow-hidden rounded-sm border border-slate-300 bg-[#fbfaf6] p-3 font-serif text-[7px] leading-[1.25] text-slate-700 shadow-sm">
      <p className="text-center text-[11px] font-bold underline">CURRICULUM VITAE</p>
      <p className="mt-1 text-center">Meera Raghavan | meera.r@example.com | +91 98765 43210 | DOB: — | Marital status: —</p>
      <p className="mt-2 font-bold underline">CAREER OBJECTIVE</p>
      <p>
        To obtain a challenging position in a reputed organisation where I can utilise my skills and knowledge for the
        growth of the organisation and myself.
      </p>
      <p className="mt-2 font-bold underline">WORK EXPERIENCE</p>
      <p>
        I am currently working as Sr. PM at Example Payments Ltd since Apr 2021 where I am responsible for instant refunds
        which I launched and it reduced refund time from 5 days to 30 mins, I also own the merchant dashboard roadmap with
        3 eng teams and introduced quarterly customer research which 4 teams now use. Before this I was PM in Sample
        Lending Co. Mumbai (Jun 2017 - Mar 2021) responsible for digital loan application flow built from scratch, approvals
        increased 18%, worked with risk &amp; compliance for launch in 2 new states. 2015-2017 Business Analyst, Demo
        Consulting, process analysis &amp; reporting for banking clients.
      </p>
      <p className="mt-2 font-bold underline">EDUCATIONAL QUALIFICATION</p>
      <table className="mt-1 w-full border-collapse">
        <tbody>
          {['MBA | Example Inst. of Mgmt | 2015 | 3.6', 'B.Tech CS | Sample Engg College | 2013 | First Class'].map((r) => (
            <tr key={r}>
              {r.split(' | ').map((c) => (
                <td key={c} className="border border-slate-400 px-1">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 font-bold underline">DECLARATION</p>
      <p>I hereby declare that the above information is true to the best of my knowledge and belief.</p>
    </div>
  );
}

/** Example for the start page: an old CV next to the same facts in the Classic template. */
export function BeforeAfter({ size }: { size: number }) {
  const scale = size / A4_WIDTH;
  const height = A4_HEIGHT * scale;
  return (
    <figure className="flex items-center justify-center gap-3" aria-label="Example: an old CV becomes a clean CV with the same facts">
      <div className="flex flex-col items-center gap-2" aria-hidden="true">
        <div style={{ width: size * 0.85, height: height * 0.85 }} className="rotate-[-3deg] opacity-90">
          <OldCv />
        </div>
        <span className="text-xs font-medium text-slate-500">Your old CV</span>
      </div>
      <span className="text-2xl text-brand" aria-hidden="true">
        →
      </span>
      <div className="flex flex-col items-center gap-2" aria-hidden="true">
        <div className="overflow-hidden rounded-sm border border-slate-200 bg-white shadow-md" style={{ width: size, height }}>
          <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left', width: A4_WIDTH }}>
            <CvTemplate draft={sampleCv} />
          </div>
        </div>
        <span className="text-xs font-semibold text-brand-dark">Same facts, clean layout</span>
      </div>
    </figure>
  );
}
