"use client";

import { useState, useEffect } from "react";
import AOS from "aos";
import "devicon/devicon.min.css";
import { NonNullableMember } from "@/app/components/LeaderboardTable";
import { formatHours } from "@/app/utils/time";

import StatsCard from "@/app/components/dashboard/widgets/StatsCard";
import LanguageDestribution from "@/app/components/dashboard/widgets/LanguageDestribution";
import Editors from "@/app/components/dashboard/widgets/Editors";
import OperatingSystem from "@/app/components/dashboard/widgets/OperatingSystem";
import { StatsData } from "@/app/components/dashboard/Stats";

export default function StatsClientView({ members }: { members: NonNullableMember[] }) {
  const [animated, setAnimated] = useState(false);

  useEffect(() => {
    setTimeout(() => {
      AOS.refresh();
      setAnimated(true);
    }, 200);
  }, []);

  const totalSeconds = members.reduce((acc, m) => acc + (m.total_seconds || 0), 0);
  const totalDevs = members.length;

  const languageTime: Record<string, number> = {};
  const editorTime: Record<string, number> = {};
  const osTime: Record<string, number> = {};

  members.forEach((m) => {
    (m.languages as any[] || []).forEach((l) => {
      languageTime[l.name] = (languageTime[l.name] || 0) + (l.total_seconds || 0);
    });
    (m.editors as any[] || []).forEach((e) => {
      editorTime[e.name] = (editorTime[e.name] || 0) + (e.total_seconds || 0);
    });
    (m.operating_systems as any[] || []).forEach((os) => {
      osTime[os.name] = (osTime[os.name] || 0) + (os.total_seconds || 0);
    });
  });

  const languageList = Object.entries(languageTime)
    .map(([name, total_seconds]) => ({ 
      name, 
      total_seconds, 
      percent: (total_seconds / Math.max(totalSeconds, 1)) * 100 
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds);
    
  const editorList = Object.entries(editorTime)
    .map(([name, total_seconds]) => ({ 
      name, 
      total_seconds, 
      percent: (total_seconds / Math.max(totalSeconds, 1)) * 100 
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds);
    
  const osList = Object.entries(osTime)
    .map(([name, total_seconds]) => ({ 
      name, 
      total_seconds, 
      percent: (total_seconds / Math.max(totalSeconds, 1)) * 100 
    }))
    .sort((a, b) => b.total_seconds - a.total_seconds);
  
  const mockStatsData: StatsData = {
    total_seconds: totalSeconds,
    daily_average: totalSeconds / Math.max(totalDevs, 1),
    languages: languageList,
    editors: editorList,
    operating_systems: osList,
  };

  const totalHoursFormatted = formatHours(totalSeconds);
  const avgHoursFormatted = formatHours(mockStatsData.daily_average || 0);
  const topLang = languageList[0]?.name || "N/A";
  const topEditor = editorList[0]?.name || "N/A";

  const totalCodingProgress = Math.min(100, (totalSeconds / (40 * 3600 * Math.max(totalDevs, 1))) * 100);
  const dailyAverageProgress = Math.min(100, (mockStatsData.daily_average / (8 * 3600)) * 100);
  const topLangProgress = languageList[0]?.percent || 0;
  const topEditorProgress = editorList[0]?.percent || 0;
  
  const sortedMembers = [...members].sort((a, b) => (b.total_seconds || 0) - (a.total_seconds || 0));

  const statCards = [
    {
      label: "Total Coding",
      value: totalHoursFormatted,
      sub: "Leaderboard Total",
      color: "#6366f1",
      trend: `${totalDevs} Dev${totalDevs !== 1 ? 's' : ''}`,
      trendUp: true,
      progress: totalCodingProgress || 50,
    },
    {
      label: "Avg Per Dev",
      value: avgHoursFormatted,
      sub: "Total average",
      color: "#8b5cf6",
      trend: `${dailyAverageProgress.toFixed(0)}%`,
      trendUp: true,
      progress: dailyAverageProgress || 50,
    },
    {
      label: "Top Language",
      value: topLang,
      sub: formatHours(languageList[0]?.total_seconds || 0),
      color: "#22d3ee",
      trend: `${topLangProgress.toFixed(0)}%`,
      trendUp: true,
      progress: topLangProgress,
    },
    {
      label: "Editor",
      value: topEditor,
      sub: formatHours(editorList[0]?.total_seconds || 0),
      color: "#34d399",
      trend: `${topEditorProgress.toFixed(0)}%`,
      trendUp: true,
      progress: topEditorProgress,
    },
    {
      label: "Top Member",
      value: sortedMembers[0] ? (sortedMembers[0].email?.split("@")[0] || "Unknown") : "N/A",
      sub: sortedMembers[0] ? formatHours(sortedMembers[0].total_seconds || 0) : "",
      color: "#f59e0b",
      trend: "1st",
      trendUp: true,
      progress: 100,
    },
  ];

  const pieData = languageList.slice(0, 6).map((l) => ({
    name: l.name,
    value: l.total_seconds,
  }));

  return (
    <div className="w-full relative z-10" data-aos="fade-in">
      {/* 5-Column Stats Cards (Matching Dashboard) */}
      <StatsCard statCards={statCards} animated={animated} setAnimated={setAnimated} />
      
      {/* 3-Column Chart Layout (Matching Dashboard) */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <LanguageDestribution pieData={pieData} />
        </div>
        
        <div className="glass-card p-6" data-aos="fade-up" data-aos-delay="400">
          <Editors stats={mockStatsData} />
        </div>

        <div className="glass-card p-6" data-aos="fade-up" data-aos-delay="500">
          <OperatingSystem stats={mockStatsData} />
        </div>
      </div>
    </div>
  );
}
