import { QuestionPacer } from "../components/QuestionPacer";
import { MouseInteractiveBackground } from "../components/MouseInteractiveBackground";

export default function PacerPage() {
  return (
    <div className="relative flex flex-1 flex-col items-center p-6 font-sans overflow-y-auto">
      <MouseInteractiveBackground />
      
      <div className="z-10 w-full max-w-4xl mx-auto flex flex-col gap-6 items-center justify-center">
        <QuestionPacer className="w-full" />
      </div>
    </div>
  );
}
