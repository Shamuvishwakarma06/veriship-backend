const express = require("express");
const axios = require("axios");
const cors = require("cors");
require("dotenv").config();
const { MongoClient } = require("mongodb");

// Initialize App
const app = express();
app.use(cors());
app.use(express.json());

// Database Setup
let orders;
async function connectDB() {
  try {
    const client = new MongoClient(process.env.MONGO_URI);
    await client.connect();
    orders = client.db("veriship").collection("orders");
    console.log("📦 Connected to MongoDB");
  } catch (error) {
    console.log("❌ MongoDB connection error:", error.message);
  }
}

connectDB();

// Root Route
app.get("/", (req, res) => {
  res.json({
    status: "API Online",
    message: "Welcome to Veriship Risk Scoring API 🚀",
    endpoints: {
      riskCheck: "/risk-check (POST)"
    }
  });
});

// Risk Check Route
app.post("/risk-check", async (req, res) => {
  const { phone } = req.body;

  if (!phone) {
    return res.status(400).json({ error: "Phone number is required" });
  }

  try {
    const url = `http://apilayer.net/api/validate?access_key=${process.env.NUMVERIFY_API_KEY}&number=${phone}&country_code=IN&format=1`;
    const result = await axios.get(url);
    const data = result.data;

    // Basic Risk Score Logic
    let score = 0;
    let reasons = [];

    if (!data.valid) {
      score += 40;
      reasons.push("Invalid phone number format");
    }

    if (data.line_type === "voip") {
      score += 25;
      reasons.push("VOIP number detected (higher fraud risk)");
    }

    if (!data.carrier) {
      score += 20;
      reasons.push("Unknown carrier");
    }

    // Score → Risk Level
    let risk_level = "LOW";
    if (score >= 60) risk_level = "HIGH";
    else if (score >= 30) risk_level = "MEDIUM";

    const response = {
      phone,
      score,
      risk_level,
      reasons,
      lookup_meta: {
        international_format: data.international_format,
        local_format: data.local_format,
        carrier: data.carrier,
        line_type: data.line_type
      },
      timestamp: new Date()
    };

    if (orders) await orders.insertOne(response);

    res.json(response);

  } catch (error) {
    res.status(500).json({ 
      error: "Verification API failed",
      details: error.message 
    });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () =>
  console.log(`🚀 Veriship backend running on port ${PORT}`)
);
