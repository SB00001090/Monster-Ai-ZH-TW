const { drizzle } = require('drizzle-orm/mysql2');
const mysql = require('mysql2/promise');
require('dotenv').config();

const tutorialContent = [
  {
    title: "Getting Started with MonsterAi",
    description: "Learn the basics of creating and using AI characters",
    category: "basics",
    order: 1,
    content: `
<h2>Welcome to MonsterAi</h2>
<p>MonsterAi is a platform for creating and interacting with custom AI characters. This tutorial will guide you through the basics.</p>
<h3>What You'll Learn</h3>
<ul>
  <li>How to create your first character</li>
  <li>How to have conversations with your character</li>
  <li>How to customize your character's personality</li>
</ul>
<h3>Getting Started</h3>
<p>Start by clicking the "Create a Character" button in the main menu. You'll be guided through a simple form to define your character's basic properties.</p>
    `,
    videoUrl: null,
    estimatedTime: 5,
    isActive: 1,
  },
  {
    title: "Creating Your First Character",
    description: "Step-by-step guide to creating a custom AI character",
    category: "character",
    order: 2,
    content: `
<h2>Creating Your First Character</h2>
<p>Follow these steps to create your first AI character:</p>
<h3>Step 1: Basic Information</h3>
<p>Enter a name and description for your character. The name should be memorable and the description should capture the essence of your character.</p>
<h3>Step 2: Personality</h3>
<p>Define your character's worldview and opening line. These elements will shape how your character interacts with users.</p>
<h3>Step 3: Review and Create</h3>
<p>Review your character's details and click "Create Character" to save your new character.</p>
<h3>Next Steps</h3>
<p>Once created, you can start chatting with your character or make it public for others to discover.</p>
    `,
    videoUrl: null,
    estimatedTime: 8,
    isActive: 1,
  },
  {
    title: "Having Conversations",
    description: "Learn how to interact with your AI characters",
    category: "chat",
    order: 3,
    content: `
<h2>Having Conversations with Your Character</h2>
<p>Once you've created a character, you can start having conversations with them.</p>
<h3>Starting a Conversation</h3>
<p>Click "New Chat" and select a character to start a conversation. Your character will greet you with their opening line.</p>
<h3>Tips for Better Conversations</h3>
<ul>
  <li>Be specific in your questions</li>
  <li>Ask follow-up questions to explore topics deeper</li>
  <li>Share context about what you're interested in</li>
</ul>
<h3>Saving Conversations</h3>
<p>All conversations are automatically saved. You can view your conversation history in the "Conversations" section.</p>
    `,
    videoUrl: null,
    estimatedTime: 6,
    isActive: 1,
  },
  {
    title: "Sharing Your Character",
    description: "Make your character public and share it with the community",
    category: "community",
    order: 4,
    content: `
<h2>Sharing Your Character with the Community</h2>
<p>Share your unique characters with other MonsterAi users!</p>
<h3>Making Your Character Public</h3>
<p>Go to your character's settings and toggle "Make Public". Your character will now appear in the Community section.</p>
<h3>Character Visibility</h3>
<p>Public characters can be discovered and cloned by other users. Your character will be rated based on user interactions.</p>
<h3>Building Your Reputation</h3>
<p>Create interesting and engaging characters to build your reputation in the community. Popular characters appear higher in search results.</p>
    `,
    videoUrl: null,
    estimatedTime: 5,
    isActive: 1,
  },
  {
    title: "Using Character Templates",
    description: "Explore pre-built character templates to get started quickly",
    category: "templates",
    order: 5,
    content: `
<h2>Using Character Templates</h2>
<p>MonsterAi provides pre-built character templates to help you get started quickly.</p>
<h3>Available Templates</h3>
<p>Browse our collection of templates including detectives, mentors, comedians, and more. Each template comes with pre-configured personality traits.</p>
<h3>Customizing Templates</h3>
<p>After selecting a template, you can customize the character's name, description, and personality to make it unique.</p>
<h3>Template Categories</h3>
<ul>
  <li>Professionals: Experts in various fields</li>
  <li>Entertainers: Comedians, storytellers, and performers</li>
  <li>Mentors: Teachers and guides</li>
  <li>Creative: Artists and writers</li>
</ul>
    `,
    videoUrl: null,
    estimatedTime: 7,
    isActive: 1,
  },
];

async function seedTutorials() {
  let connection;
  try {
    console.log("Connecting to database...");
    
    connection = await mysql.createConnection(process.env.DATABASE_URL);
    
    console.log("Seeding tutorials...");
    
    for (const tutorial of tutorialContent) {
      const query = `
        INSERT INTO tutorials (title, description, category, \`order\`, content, videoUrl, estimatedTime, isActive)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      await connection.execute(query, [
        tutorial.title,
        tutorial.description,
        tutorial.category,
        tutorial.order,
        tutorial.content,
        tutorial.videoUrl,
        tutorial.estimatedTime,
        tutorial.isActive,
      ]);
      
      console.log(`✓ Created tutorial: ${tutorial.title}`);
    }
    
    console.log("\n✓ All tutorials seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding tutorials:", error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

seedTutorials();
