"use client";

import { TestProvider, useTest } from "@/components/ielts/TestProvider";
import { HomeScreen } from "@/components/ielts/HomeScreen";
import { ListeningModule } from "@/components/ielts/ListeningModule";
import { ReadingModule } from "@/components/ielts/ReadingModule";
import { WritingModule } from "@/components/ielts/WritingModule";
import { SpeakingModule } from "@/components/ielts/SpeakingModule";
import { ResultsScreen } from "@/components/ielts/ResultsScreen";

function TestApp() {
  const { state } = useTest();

  if (state.phase === "results") {
    return <ResultsScreen />;
  }

  if (state.phase === "test" && state.currentModule) {
    switch (state.currentModule) {
      case "listening":
        return <ListeningModule />;
      case "reading":
        return <ReadingModule />;
      case "writing":
        return <WritingModule />;
      case "speaking":
        return <SpeakingModule />;
    }
  }

  return <HomeScreen />;
}

export default function HomePage() {
  return (
    <TestProvider>
      <TestApp />
    </TestProvider>
  );
}
