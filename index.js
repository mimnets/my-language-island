import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// ১. সার্ভার তৈরি
const server = new McpServer({
  name: "FrenchIslandCoach",
  version: "1.0.0",
});

// ২. আপনার GitHub-এর Raw লিঙ্কটি এখানে বসান
// (গিটহাবে গিয়ে data.json ফাইলটি ওপেন করে 'Raw' বাটনে ক্লিক করলে যে লিঙ্ক পাবেন সেটি)
const GITHUB_RAW_URL = "https://raw.githubusercontent.com/mimnets/my-language-island/refs/heads/main/data.json";

// ৩. টুল তৈরি: আপনার আইল্যান্ডের বাক্যগুলো দেখার জন্য
server.tool("get_my_island", {}, async () => {
  try {
    const response = await fetch(GITHUB_RAW_URL);
    const data = await response.json();
    
    return {
      content: [{ 
        type: "text", 
        text: `Bonjour Sabbir! Here is your current Language Island:\n\n${JSON.stringify(data, null, 2)}` 
      }]
    };
  } catch (error) {
    return {
      content: [{ type: "text", text: "Error: Could not fetch data from GitHub." }]
    };
  }
});

// ৪. টুল তৈরি: নতুন বাক্যের পরামর্শ দেওয়ার জন্য (আপনার ইন্ডাস্ট্রি অনুযায়ী)
server.tool("suggest_sentences", 
  { topic: "string" }, 
  async ({ topic }) => {
    return {
      content: [{ 
        type: "text", 
        text: `I will now generate 3 new French sentences for you about ${topic}. Please remember to add them to your GitHub data.json later.` 
      }]
    };
  }
);

// ৫. সার্ভার রান করা
const transport = new StdioServerTransport();
await server.connect(transport);
