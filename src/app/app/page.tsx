/**
 * @file page.tsx
 * @description /app entry — terminal on localhost; redirects on production hosts (#78)
 * @license Proprietary / All Rights Reserved
 * © 2026 0xTERM. All rights reserved. Unauthorized copying or distribution is strictly prohibited.
 */
"use client";

import { AppPathHostGate } from "@/components/HostRedirect";
import TerminalApp from "@/components/terminal/TerminalApp";

export default function AppPage() {
  return (
    <AppPathHostGate terminal={<TerminalApp />} />
  );
}
