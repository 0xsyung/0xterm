"use client";

import { useState } from "react";
import { Providers } from "./providers";
import MatrixRain from "@/components/terminal/MatrixRain";
import TerminalShell from "@/components/terminal/TerminalShell";

export default function Home() {
  const [rainActive, setRainActive] = useState(true);

  const handleToggleRain = () => {
    setRainActive((prev) => !prev);
  };

  return (
    <Providers>
      <main className="fixed inset-0 crt-overlay bg-[#030503] overflow-hidden flex flex-col">
        <MatrixRain active={rainActive} />
        <TerminalShell onToggleRain={handleToggleRain} />
      </main>
    </Providers>
  );
}
