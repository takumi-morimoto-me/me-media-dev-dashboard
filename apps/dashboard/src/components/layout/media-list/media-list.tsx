import { createClient } from "@/lib/supabase/server";
import { MediaListClient } from "./media-list-client";

export async function MediaList() {
  const supabase = await createClient();

  // Fetch media data from Supabase
  const { data: mediaData, error } = await supabase
    .from("media")
    .select("id, name, slug")
    .order("name", { ascending: true });

  console.log("MediaList - Data:", mediaData);
  console.log("MediaList - Error:", error);

  if (error) {
    console.error("Error fetching media data:", error);
    return <MediaListClient mediaData={[]} />;
  }

  return <MediaListClient mediaData={mediaData || []} />;
}
