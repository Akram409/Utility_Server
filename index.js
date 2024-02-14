const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const port = process.env.PORT || 5000;
const crypto = require("crypto");

// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion } = require("mongodb");

const uri =
  "mongodb+srv://utility-user:T6n7CYIgNyYtB23m@cluster0.coipt.mongodb.net/?retryWrites=true&w=majority";

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});
async function run() {
  try {
    // Connect the client to the server (optional starting in v4.7)
    await client.connect();

    const userCollection = client.db("utility").collection("user");
    const eventCollection = client.db("utility").collection("events");

    // Generate random secret key
    const generateSecretKey = () => {
      return crypto.randomBytes(32).toString("hex"); // Generates a random 32-byte hexadecimal string
    };

    const secretKey = generateSecretKey();

    // Use unique indexes for username and email to prevent duplicates
    await userCollection.createIndex(
      { username: 1 },
      { unique: true, background: true }
    );
    await userCollection.createIndex(
      { email: 1 },
      { unique: true, background: true }
    );

    app.post("/signup", async (req, res) => {
      try {
        const { username, email, password } = req.body;
        if (!username || !email || !password) {
          throw new Error("Username, email, and password are required");
        }

        try {

          // Perform duplicate checks within the transaction:
          const existingUserByUsername = await userCollection.findOne({ username });
          const existingUserByEmail = await userCollection.findOne({ email });

          if (existingUserByUsername) {
            // Username already exists
            res.status(400).json({
              error: "Username already exists. Please choose a different username.",
            });
          } else if (existingUserByEmail) {
            // Email already exists
            res.status(400).json({
              error: "An account with this email already exists. Please use a different email.",
            });
          } else {
            // Hash password and create new user object
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = {
              username,
              email,
              role,
              password: hashedPassword
            };

            // Insert the new user within the transaction:
            await userCollection.insertOne(newUser);

            res.status(201).json({ message: "User created successfully" });
          }
        } catch (error) {
          res.status(500).json({ error: error.message });
        }
      } catch (error) {
        res.status(500).json({ error: error.message });
      }
    });

    app.post("/login", async (req, res) => {
      try {
        const { email, password } = req.body;

        // Input validation:
        if (!email || !password) {
          throw new Error("Both email and password are required.");
        }

        // Search by email only:
        const user = await userCollection.findOne({ email });

        // Handle cases where no user is found or password is incorrect:
        if (!user || !await bcrypt.compare(password, user.password)) {
          res.status(401).json({ error: "Invalid email or password." });
          return; // Prevent duplicate error message in case both conditions are met
        }

        // Generate and send the token with only necessary data:
        const token = jwt.sign({ id: user._id, email, role: user.role }, secretKey, { expiresIn: "7d" });
        res.json({ auth: true, token });
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Create an event
    app.post("/events", async (req, res) => {
      try {
        const { title, description, start, end } = req.body;
        const newEvent = { title, description, start, end };
        const result = await eventCollection.insertOne(newEvent);
        res.status(201).json({ message: "Event created successfully", id: result.insertedId });
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Get all events
    app.get("/events", async (req, res) => {
      try {
        const events = await eventCollection.find({}).toArray();
        res.json(events);
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Get a single event by ID
    app.get("/events/:id", async (req, res) => {
      try {
        const eventId = req.params.id;
        const event = await eventCollection.findOne({ _id: new MongoClient.ObjectId(eventId) });
        if (!event) {
          res.status(404).json({ error: "Event not found." });
        } else {
          res.json(event);
        }
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Update an event
    app.put("/events/:id", async (req, res) => {
      try {
        const eventId = req.params.id;
        const { title, description, start, end } = req.body;
        const updatedEvent = { title, description, start, end };
        const result = await eventCollection.updateOne({ _id: new MongoClient.ObjectId(eventId) }, { $set: updatedEvent });
        if (result.matchedCount === 0) {
          res.status(404).json({ error: "Event not found." });
        } else {
          res.json({ message: "Event updated successfully" });
        }
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Delete an event
    app.delete("/events/:id", async (req, res) => {
      try {
        const eventId = req.params.id;
        const result = await eventCollection.deleteOne({ _id: new MongoClient.ObjectId(eventId) });
        if (result.deletedCount === 0) {
          res.status(404).json({ error: "Event not found." });
        } else {
          res.json({ message: "Event deleted successfully" });
        }
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});