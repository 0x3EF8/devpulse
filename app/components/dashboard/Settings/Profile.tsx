"use client";

import { useState } from "react";
import { createClient } from "../../../lib/supabase/client";
import { toast } from "react-toastify";
import type { User } from "@supabase/supabase-js";
import Image from "next/image";

export default function UserProfile({ user }: { user: User }) {
  const supabase = createClient();
  const [originalName, setOriginalName] = useState(
    user?.user_metadata?.name || "",
  );
  const [name, setName] = useState(originalName);
  const [loading, setLoading] = useState(false);
  const prefferedAvatar =
    user?.user_metadata?.avatar_url ||
    user?.user_metadata?.picture ||
    user?.user_metadata?.avatar ||
    null;

  const isEdited = name !== originalName;

  async function updateProfile() {
    if (!isEdited) return;
    setLoading(true);

    const updateUserProfile = new Promise(async (resolve, reject) => {
      try {
        const { error } = await supabase.auth.updateUser({
          data: { name },
        });

        if (error) return reject(error);
        resolve("Profile updated!");
      } catch (error) {
        reject(error);
      }
    });

    toast.promise(updateUserProfile, {
      pending: "Updating profile...",
      success: "Profile updated!",
      error: {
        render({ data }) {
          setLoading(false);
          const err = data as Error;
          return err?.message || "Failed to update profile. Please try again.";
        },
      },
    });

    updateUserProfile.then(() => {
      setLoading(false);
      setOriginalName(name);
    });
  }

  return (
    <div className="glass-card p-6">
      <h3 className="text-xs font-semibold text-indigo-400 uppercase tracking-widest mb-5">
        Profile
      </h3>

      <Image
        src={prefferedAvatar}
        alt="User Avatar"
        width={80}
        height={80}
        className="rounded-full mb-4"
      />

      <label className="text-sm text-gray-400 font-medium">Email</label>
      <input
        type="email"
        className="input-field mb-4"
        value={user.email || ""}
        disabled
      />

      <label className="text-sm text-gray-400 font-medium">Name</label>
      <input
        type="text"
        className="input-field mb-4"
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <button
        onClick={updateProfile}
        disabled={!isEdited || loading}
        className={`btn-primary ${!isEdited ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        Save Changes
      </button>
    </div>
  );
}
