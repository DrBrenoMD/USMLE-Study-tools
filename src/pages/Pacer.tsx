import { QuestionPacer } from "../components/QuestionPacer";
import { MouseInteractiveBackground } from "../components/MouseInteractiveBackground";

export default function PacerPage() {
  return (
    <div className="relative flex flex-1 flex-col items-center justify-center p-6 font-sans">
      <MouseInteractiveBackground />
      <div className="z-10 w-full flex justify-center">
        <QuestionPacer className="mt-0" />
      </div>
    </div>
  );
}
