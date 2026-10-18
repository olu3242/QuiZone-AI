import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: {
    default: "QuiZone · Play Together. Solve the World.",
    template: "%s · QuiZone",
  },
  description:
    "Turn family time into an adventure. Explore quizzes, solve real-world puzzles, and build brighter ideas together.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
