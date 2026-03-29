"use client";

import { User } from "@supabase/supabase-js";
import { createClient } from "../lib/supabase/client";
import { Database } from "../supabase-types";
import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faCode,
  faExternalLink,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { timeAgo } from "../utils/time";

const supabase = createClient();

export interface Projects {
  name: string;
  text: string;
  project_description: string;
  project_url: string;
  project_time: string;
  is_open_source: boolean;
  open_source_url?: string;
}

export default function Flex({ user }: { user: User }) {
  const [loading, setLoading] = useState(false);
  const [flexes, setFlexes] = useState<Projects[]>([]);
  const [flex, setFlex] = useState<Projects | null>(null);
  const [userFlexes, setUserFlexes] = useState<
    Database["public"]["Tables"]["user_flexes"]["Row"][]
  >([]);
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flex) return;

    const { data, error } = await supabase
      .from("user_flexes")
      .insert({
        user_id: user.id,
        user_email: user.email!,
        project_name: flex.name,
        project_description: flex.project_description,
        project_url: flex.project_url,
        project_time: flex.text,
        is_open_source: flex.is_open_source,
        open_source_url: flex.open_source_url,
      })
      .select()
      .single();

    if (error) {
      console.error("Error submitting flex:", error);
    } else {
      setUserFlexes((prev) => [data, ...prev]);
      setFlex(null);
    }
  };

  const expireAt = (expireAt: string) => {
    const expiresAt = new Date(expireAt);
    const now = new Date();

    const diffMs = expiresAt.getTime() - now.getTime();
    return Math.max(Math.floor(diffMs / (1000 * 60 * 60)), 0) + "hr";
  };

  useEffect(() => {
    async function fetchFlexes() {
      setLoading(true);
      const { data, error } = await supabase
        .from("user_flexes")
        .select("*")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching flexes:", error);
      } else {
        setUserFlexes(data);
      }
      setLoading(false);
    }

    fetchFlexes();
  }, [user.id]);

  useEffect(() => {
    if (!showModal) return;

    async function fetchFlexes() {
      const { data, error } = await supabase
        .from("user_projects")
        .select("projects")
        .eq("user_id", user.id);

      if (error) {
        console.error("Error fetching flexes:", error);
      } else {
        const projects: Projects[] = data[0].projects as unknown as Projects[];
        const newProjects = projects.filter(
          (p) => !userFlexes.some((f) => f.project_name === p.name),
        );
        setFlexes(newProjects);
      }
    }

    fetchFlexes();
  }, [showModal, userFlexes, user.id]);

  return (
    <div className="p-4 sm:p-6 md:p-8 w-full max-w-7xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div
        className="relative z-10 flex flex-col sm:flex-row justify-between items-start sm:items-center w-full gap-4 bg-gray-900/20 p-6 rounded-2xl border border-white/5 shadow-sm"
        data-aos="fade-down"
      >
        <div className="flex flex-col">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-400 bg-clip-text text-transparent truncate flex items-center gap-3">
            Developer Flexes
          </h1>
          <p className="text-sm font-medium text-gray-400 mt-2 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_12px_rgba(52,211,153,0.8)] shrink-0"></span>
            <span>
              Showcase your top repository work with the community.
            </span>
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-6 shrink-0 w-full sm:w-auto mt-2 sm:mt-0">
          <button
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto btn-primary px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40 transition-all flex justify-center items-center gap-2"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
            New Flex
          </button>
        </div>
      </div>

      {loading && (
        <div className="p-6 flex items-center justify-center">
          <p className="text-gray-400">Loading your flexes...</p>
        </div>
      )}

      {flex && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[100] backdrop-blur-md p-4">
          <div className="glass-card p-6 sm:p-8 w-full max-w-lg relative overflow-hidden shadow-2xl border border-white/10" data-aos="zoom-in" data-aos-duration="300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-indigo-500"></div>
            <form onSubmit={handleSubmit} className="relative z-10 flex flex-col gap-4">
              <div>
                <h2 className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent mb-1">
                  Flex: {flex.name}
                </h2>
                <p className="text-sm text-gray-400">{flex.text}</p>
              </div>

              <div className="space-y-4 mt-2">
                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Project Name</label>
                  <input
                    type="text"
                    value={flex.name || ""}
                    disabled
                    className="w-full px-4 py-2.5 bg-gray-900/50 text-gray-400 border border-gray-800 rounded-xl outline-none cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Description</label>
                  <textarea
                    value={flex.project_description || ""}
                    onChange={(e) =>
                      setFlex({ ...flex, project_description: e.target.value })
                    }
                    placeholder="What makes this project awesome?"
                    className="w-full px-4 py-2.5 bg-gray-900/50 text-gray-100 placeholder:text-gray-600 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none transition-all resize-none"
                    rows={3}
                  ></textarea>
                </div>

                <div>
                  <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1 block">Live URL</label>
                  <input
                    type="url"
                    value={flex.project_url || ""}
                    onChange={(e) =>
                      setFlex({ ...flex, project_url: e.target.value })
                    }
                    placeholder="https://your-project.com"
                    className="w-full px-4 py-2.5 bg-gray-900/50 text-gray-100 placeholder:text-gray-600 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none transition-all"
                  />
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-xl border border-gray-800/50">
                  <input
                    type="checkbox"
                    id="is_open_source"
                    checked={flex.is_open_source || false}
                    onChange={(e) =>
                      setFlex({ ...flex, is_open_source: e.target.checked })
                    }
                    className="w-4 h-4 rounded border-gray-600 text-indigo-500 focus:ring-indigo-500 focus:ring-offset-gray-900 bg-gray-700"
                  />
                  <label htmlFor="is_open_source" className="text-sm font-medium text-gray-300 cursor-pointer select-none">
                    Is this project open source?
                  </label>
                </div>

                {flex.is_open_source && (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <label className="text-xs font-semibold text-emerald-500/80 uppercase tracking-wider mb-1 block">Repository URL</label>
                    <input
                      type="url"
                      value={flex.open_source_url || ""}
                      onChange={(e) =>
                        setFlex({ ...flex, open_source_url: e.target.value })
                      }
                      placeholder="https://github.com/..."
                      className="w-full px-4 py-2.5 bg-emerald-900/10 text-gray-100 placeholder:text-emerald-900/40 border border-emerald-900/30 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl outline-none transition-all"
                    />
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-gray-800/80">
                <button
                  type="button"
                  onClick={() => setFlex(null)}
                  className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary px-6 py-2.5 text-sm font-medium rounded-xl shadow-lg shadow-indigo-500/20"
                >
                  Submit Flex
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {userFlexes.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center p-12 text-center bg-gray-900/20 border border-dashed border-gray-800 rounded-2xl" data-aos="fade-in">
          <div className="w-16 h-16 rounded-full bg-indigo-500/10 flex items-center justify-center mb-4 text-indigo-400">
             <FontAwesomeIcon icon={faCode} className="w-8 h-8" />
          </div>
          <h3 className="text-xl font-bold text-white mb-2">No Flexes Yet</h3>
          <p className="text-gray-400 max-w-md mx-auto mb-6">
            You haven&apos;t shared any of your projects yet. Hit &quot;New Flex&quot; to show off your best work to the DevPulse community!
          </p>
        </div>
      )}

      {userFlexes.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {userFlexes.map((f) => (
            <div key={f.id} className="glass-card p-6 flex flex-col group relative overflow-hidden flex-1 hover:border-indigo-500/30 transition-all duration-300">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <div className="flex items-start justify-between mb-4 relative z-10">
                <h3 className="text-xl font-bold text-white group-hover:text-indigo-300 transition-colors truncate pr-4">{f.project_name}</h3>
                <span className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-500/10 text-indigo-400 text-xs font-semibold whitespace-nowrap shrink-0">
                  <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                  {f.project_time}
                </span>
              </div>
              <p className="text-sm text-gray-400 mb-6 flex-1 relative z-10 leading-relaxed line-clamp-3">{f.project_description}</p>
              
              <div className="flex flex-col gap-3 relative z-10 mt-auto">
                <a
                  className="flex items-center gap-2 text-sm text-gray-300 hover:text-white transition-colors p-2 rounded-lg bg-gray-800/30 hover:bg-gray-800/60 w-fit"
                  href={f.project_url}
                  title="Click to view project"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <FontAwesomeIcon icon={faExternalLink} className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[200px]">{f.project_url.replace(/^https?:\/\//, '')}</span>
                </a>
                
                {f.is_open_source && (
                  <a
                    className="flex items-center gap-2 text-sm text-emerald-400/80 hover:text-emerald-400 transition-colors p-2 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 w-fit"
                    href={f.open_source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FontAwesomeIcon icon={faCode} className="w-3.5 h-3.5" />
                    <span className="truncate max-w-[200px]">Repository</span>
                  </a>
                )}
              </div>
              
              <div className="mt-6 pt-4 border-t border-gray-800/50 flex items-center justify-between text-xs text-gray-500 relative z-10">
                <span>Posted {timeAgo(f.created_at)}</span>
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400/80 animate-pulse"></span>
                  Expires in {expireAt(f.expires_at || "")}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black/60 z-[100] backdrop-blur-md p-4">
          <div className="glass-card p-6 sm:p-8 w-full max-w-lg border border-white/10 shadow-2xl relative overflow-hidden" data-aos="zoom-in" data-aos-duration="300">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500"></div>
            <h2 className="text-xl font-bold mb-4 text-white">Select a Project</h2>
            <div className="relative mb-4">
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search projects..."
                className="w-full px-4 py-3 bg-gray-900/50 text-gray-100 placeholder:text-gray-600 border border-gray-700 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 rounded-xl outline-none transition-all pl-11"
              />
              <svg className="w-5 h-5 absolute left-4 top-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path></svg>
            </div>
            
            <div className="space-y-2 max-h-72 overflow-y-auto pr-2 custom-scrollbar">
              {flexes.length === 0 && !loading && (
                <div className="p-8 flex flex-col items-center justify-center text-center border border-dashed border-gray-800 rounded-xl bg-gray-900/20">
                  <p className="text-gray-400 text-sm">
                    You have no projects to flex yet.
                  </p>
                </div>
              )}

              {flexes
                .filter((u) =>
                  u.name.toLowerCase().includes(search.toLowerCase()),
                )
                .map((u, idx) => (
                  <div
                    key={idx}
                    onClick={() => {
                      setFlex(u);
                      setShowModal(false);
                    }}
                    className="flex items-center gap-4 p-3 rounded-xl hover:bg-gray-800/60 border border-transparent hover:border-gray-700 cursor-pointer transition-all group"
                  >
                    <div className="flex justify-center items-center w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400 font-bold border border-indigo-500/20 group-hover:scale-105 transition-transform">
                      {u.name[0].toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-gray-200 group-hover:text-white truncate transition-colors">{u.name}</h4>
                      <p className="text-xs text-gray-500 truncate">{u.text}</p>
                    </div>
                  </div>
                ))}
            </div>
            <div className="flex justify-end mt-6 pt-4 border-t border-gray-800/80">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-5 py-2.5 text-sm font-medium text-gray-400 hover:text-white bg-gray-800/50 hover:bg-gray-700/50 rounded-xl transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
