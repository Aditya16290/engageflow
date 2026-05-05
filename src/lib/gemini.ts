export async function generateBlogContent(topic: string) {
  try {
    const response = await fetch("/api/generate-blog", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || "Failed to generate blog content");
    }

    return await response.json();
  } catch (error) {
    console.error("Blog Generation Error:", error);
    throw error;
  }
}
