import Link from "next/link";
import { ArrowRight, BookOpen, CheckCircle2, Headphones, Mic, PenTool, Sparkles } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const modules = [
    {
        title: "Listening",
        description: "Timed sections with answer validation and section breakdown reports.",
        icon: Headphones,
    },
    {
        title: "Reading",
        description: "Academic passage practice with analytics for each question.",
        icon: BookOpen,
    },
    {
        title: "Writing",
        description: "AI-assisted scoring with criterion-level feedback and rewrites.",
        icon: PenTool,
    },
    {
        title: "Speaking",
        description: "Transcript-based evaluation with strengths and improvement areas.",
        icon: Mic,
    },
];

export default function LandingPage() {
    return (
        <div className="relative min-h-screen overflow-hidden bg-background">
            <div className="pointer-events-none absolute inset-0">
                <div className="absolute -top-32 left-[-10%] h-96 w-96 rounded-full bg-primary/15 blur-3xl" />
                <div className="absolute bottom-[-12rem] right-[-6%] h-[28rem] w-[28rem] rounded-full bg-warning/10 blur-3xl" />
            </div>

            <header className="relative z-10 mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-6">
                <Link href="/" className="text-xl font-heading font-bold text-foreground">
                    Test Craft
                </Link>

                <div className="flex items-center gap-2">
                    <Link href="/auth/login" className={cn(buttonVariants({ variant: "ghost" }), "font-semibold")}>
                        Sign In
                    </Link>
                    <Link href="/auth/register" className={cn(buttonVariants(), "font-semibold")}>
                        Sign Up
                    </Link>
                </div>
            </header>

            <main className="relative z-10 mx-auto w-full max-w-6xl px-6 pb-16 pt-8 sm:pt-14">
                <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
                    <section>
                        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-primary">
                            <Sparkles className="h-4 w-4" />
                            Academic Mock Test Platform
                        </div>

                        <h1 className="max-w-xl text-4xl font-heading font-bold leading-tight text-foreground sm:text-5xl lg:text-6xl">
                            Build exam confidence with <span className="text-gradient-gold">Test Craft</span>
                        </h1>

                        <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
                            Practice Listening, Reading, Writing, and Speaking in one focused workflow with instant scoring,
                            detailed module reports, and certificate generation.
                        </p>

                        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                            <Link href="/auth/register" className={cn(buttonVariants({ size: "lg" }), "font-semibold")}> 
                                Start with Sign Up
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                            <Link href="/auth/login" className={cn(buttonVariants({ variant: "outline", size: "lg" }), "font-semibold")}>
                                I already have an account
                            </Link>
                        </div>

                        <ul className="mt-8 grid gap-2 text-sm text-foreground">
                            <li className="inline-flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                Dedicated login and register flow before dashboard access
                            </li>
                            <li className="inline-flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                AI-backed writing and speaking evaluation
                            </li>
                            <li className="inline-flex items-center gap-2">
                                <CheckCircle2 className="h-4 w-4 text-success" />
                                Progress saved in your private student account
                            </li>
                        </ul>
                    </section>

                    <section className="rounded-2xl border border-border bg-card/80 p-5 shadow-card sm:p-6">
                        <h2 className="text-lg font-heading font-bold text-foreground sm:text-xl">Inside the Test Craft dashboard</h2>
                        <p className="mt-1 text-sm text-muted-foreground">Choose any module, complete all four, and generate your certificate.</p>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2">
                            {modules.map(({ title, description, icon: Icon }) => (
                                <div key={title} className="rounded-xl border border-border bg-secondary/25 p-4">
                                    <div className="mb-2 inline-flex rounded-lg border border-primary/20 bg-primary/10 p-2 text-primary">
                                        <Icon className="h-4 w-4" />
                                    </div>
                                    <p className="text-sm font-semibold text-foreground">{title}</p>
                                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{description}</p>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </main>
        </div>
    );
}
