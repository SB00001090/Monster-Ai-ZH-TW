import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const tutorialContent = [
  {
    title: "Getting Started with MonsterAi",
    description: "Learn the basics of creating and using AI characters",
    category: "basics",
    order: 1,
    content: `<h2>Welcome to MonsterAi</h2><p>MonsterAi is a platform for creating and interacting with custom AI characters. This tutorial will guide you through the basics.</p>`,
    videoUrl: null,
    estimatedTime: 5,
    isActive: 1,
  },
  {
    title: "Creating Your First Character",
    description: "Step-by-step guide to creating a custom AI character",
    category: "character",
    order: 2,
    content: `<h2>Creating Your First Character</h2><p>Follow these steps to create your first AI character.</p>`,
    videoUrl: null,
    estimatedTime: 8,
    isActive: 1,
  },
  {
    title: "Having Conversations",
    description: "Learn how to interact with your AI characters",
    category: "chat",
    order: 3,
    content: `<h2>Having Conversations with Your Character</h2><p>Once you've created a character, you can start having conversations with them.</p>`,
    videoUrl: null,
    estimatedTime: 6,
    isActive: 1,
  },
  {
    title: "Sharing Your Character",
    description: "Make your character public and share it with the community",
    category: "community",
    order: 4,
    content: `<h2>Sharing Your Character with the Community</h2><p>Share your unique characters with other MonsterAi users!</p>`,
    videoUrl: null,
    estimatedTime: 5,
    isActive: 1,
  },
  {
    title: "Using Character Templates",
    description: "Explore pre-built character templates to get started quickly",
    category: "templates",
    order: 5,
    content: `<h2>Using Character Templates</h2><p>MonsterAi provides pre-built character templates to help you get started quickly.</p>`,
    videoUrl: null,
    estimatedTime: 7,
    isActive: 1,
  },
];

async function seedTutorials() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: {},
  });

  try {
    console.log("Seeding tutorials...");
    
    for (const tutorial of tutorialContent) {
      await connection.execute(
        `INSERT INTO tutorials (title, description, category, \`order\`, content, videoUrl, estimatedTime, isActive) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          tutorial.title,
          tutorial.description,
          tutorial.category,
          tutorial.order,
          tutorial.content,
          tutorial.videoUrl,
          tutorial.estimatedTime,
          tutorial.isActive,
        ]
      );
      console.log(`✓ Created tutorial: ${tutorial.title}`);
    }
    
    console.log("\n✓ All tutorials seeded successfully!");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding tutorials:", error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

seedTutorials();
