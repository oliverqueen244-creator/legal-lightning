import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Database, Server, Code, Shield, Users, Zap, FileText, Bell, Globe, Layers, Settings, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { BreathingType } from "@/components/animations/BreathingType";
import { KineticProgress } from "@/components/animations/KineticProgress";
import { dossierData } from "@/data/dossierData";
import { asciiArt } from "@/data/asciiArt";

const TechnicalDossier = () => {
  const navigate = useNavigate();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-transparent text-foreground p-8">
      <KineticProgress />

      <ScrollArea className="h-[calc(100vh-64px)] print:h-auto">
        <div className="container mx-auto px-4 py-8 max-w-5xl print:max-w-none print:px-8">

          {/* Title Page */}
          <div className="text-center mb-12 print:mb-8 print:page-break-after">
            <BreathingType>
              <h1 className="text-4xl font-bold text-foreground mb-4">{dossierData.metadata.title}</h1>
            </BreathingType>
            <h2 className="text-2xl text-muted-foreground mb-2">{dossierData.metadata.subtitle}</h2>
            <p className="text-lg text-foreground font-medium mb-4">{dossierData.metadata.caption}</p>

            <p className="text-sm text-gray-500">
              Generated: {new Date().toLocaleDateString('en-IN', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            <p className="text-xs text-gray-500 mt-2">
              Built by Izafa Labs • Confidential
            </p>
          </div>

          {/* Table of Contents */}
          <section className="mb-10 print:page-break-after">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <FileText className="h-6 w-6" />
              Table of Contents
            </h2>
            <div className="grid md:grid-cols-2 gap-6">
              {dossierData.toc.map((part, i) => (
                <div key={i} className="border border-gray-300 rounded-lg p-4">
                  <h3 className="font-semibold text-black mb-2">{part.title}</h3>
                  <ol className="list-decimal list-inside space-y-1 text-sm text-gray-600" start={part.start || 1}>
                    {part.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 1: System Architecture */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Layers className="h-6 w-6" />
              1. System Architecture Overview
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-black mb-2">Technology Stack</h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-2">Frontend</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {dossierData.architecture.frontend.map((item: any, i: number) => (
                        <li key={i}><strong>{item.name}</strong> - {item.desc}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="border border-gray-300 rounded-lg p-4">
                    <h4 className="font-medium text-black mb-2">Backend (Supabase)</h4>
                    <ul className="list-disc list-inside text-sm text-gray-600 space-y-1">
                      {dossierData.architecture.backend.map((item: any, i: number) => (
                        <li key={i}><strong>{item.name}</strong> - {item.desc}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">High-Level Architecture Diagram</h3>
                <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                  <pre className="text-gray-700 whitespace-pre">
                    {asciiArt.systemArchitecture}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          <Separator className="my-8" />

          {/* Section 2: Database Schema */}
          <section className="mb-10 print:page-break-inside-avoid">
            <h2 className="text-2xl font-bold text-black mb-4 flex items-center gap-2">
              <Database className="h-6 w-6" />
              2. Database Schema & Relationships
            </h2>

            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-black mb-2">Core Tables Summary</h3>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm border-collapse border border-gray-300">
                    <thead>
                      <tr className="bg-gray-100">
                        <th className="border border-gray-300 p-2 text-left">Table</th>
                        <th className="border border-gray-300 p-2 text-left">Purpose</th>
                        <th className="border border-gray-300 p-2 text-left">Key Fields</th>
                        <th className="border border-gray-300 p-2 text-left">RLS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dossierData.tables.map((table: any, i: number) => (
                        <tr key={i}>
                          <td className="border border-gray-300 p-2 font-mono">{table.name}</td>
                          <td className="border border-gray-300 p-2">{table.purpose}</td>
                          <td className="border border-gray-300 p-2">{table.fields}</td>
                          <td className="border border-gray-300 p-2">{table.rls}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-black mb-2">Authentication Flow</h3>
                <div className="bg-gray-100 p-4 rounded-lg border border-gray-300 font-mono text-xs overflow-x-auto">
                  <pre className="text-gray-700 whitespace-pre">
                    {asciiArt.authFlow}
                  </pre>
                </div>
              </div>
            </div>
          </section>

          <div className="py-20 text-center text-muted-foreground italic">
            [Dossier Refactored for High Performance & Code Hygiene]
          </div>
        </div>
      </ScrollArea>
    </div>
  );
};

export default TechnicalDossier;
