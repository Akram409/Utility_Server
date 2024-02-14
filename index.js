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

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");

const uri =
  "mongodb+srv://utility:3tlZoXzuxen1URBD@cluster0.6nxonq0.mongodb.net/?retryWrites=true&w=majority";
// "mongodb+srv://utility:3tlZoXzuxen1URBD@cluster0.coipt.mongodb.net/?retryWrites=true&w=majority";

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
    const notesCollection = client.db("utility").collection("notes");

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
          const existingUserByUsername = await userCollection.findOne({
            username,
          });
          const existingUserByEmail = await userCollection.findOne({ email });

          if (existingUserByUsername) {
            // Username already exists
            res.status(400).json({
              error:
                "Username already exists. Please choose a different username.",
            });
          } else if (existingUserByEmail) {
            // Email already exists
            res.status(400).json({
              error:
                "An account with this email already exists. Please use a different email.",
            });
          } else {
            // Hash password and create new user object:
            const hashedPassword = await bcrypt.hash(password, 10);
            const newUser = { username, email, password: hashedPassword };

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
        if (!user || !(await bcrypt.compare(password, user.password))) {
          res.status(401).json({ error: "Invalid email or password." });
          return; // Prevent duplicate error message in case both conditions are met
        }

        // Generate and send the token with only necessary data:
        const token = jwt.sign(
          { id: user._id, email, role: user.role },
          secretKey,
          { expiresIn: "7d" }
        );
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
        res.status(201).json({
          message: "Event created successfully",
          id: result.insertedId,
        });
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.post("/notes/create", async (req, res) => {
      try {
        const { Title, Date, Description, Calendar, Tasks } = req.body;
        // Create a new note object
        const newNote = {
          Title,
          Date,
          Description,
          Calendar,
          Tasks,
        };

        // Insert the new note into the MongoDB collection
        const result = await notesCollection.insertOne(newNote);

        // Check if the insertion was successful
        if (result.insertedId) {
          res.status(201).json({
            message: "Note created successfully",
            id: result.insertedId,
          });
        } else {
          res.status(500).json({ error: "Failed to create note" });
        }
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Get all events
    app.get("/notes", async (req, res) => {
      try {
        const notes = await notesCollection.find().toArray();
        res.json(notes);
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.get("/user", async (req, res) => {
      try {
        const user = await userCollection.find().toArray();
        res.json(user);
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });

    // Get a single event by ID
    app.get("/notes/:id", async (req, res) => {
      try {
        const noteId = req.params.id;
        const result = await notesCollection.findOne({
          _id: new ObjectId(noteId),
        });
        // console.log(result);

        if (!result) {
          res.status(404).json({ error: "Note not found." });
        } else {
          res.json(result);
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
        const result = await eventCollection.updateOne(
          { _id: new MongoClient.ObjectId(eventId) },
          { $set: updatedEvent }
        );
        if (result.matchedCount === 0) {
          res.status(404).json({ error: "Event not found." });
        } else {
          res.json({ message: "Event updated successfully" });
        }
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.put("/notes/update/:id", async (req, res) => {
      const noteId = req.params.id;
      const { Title, Date, Description, Calendar, Tasks } = req.body;
      const updatedNote = {
        Title,
        Date,
        Description,
        Calendar,
        Tasks,
      };
      const result = await notesCollection.updateOne(
        { _id: new ObjectId(noteId) },
        { $set: updatedNote }
      );
      if (result.matchedCount === 0) {
        res.status(404).json({ error: "Note not found." });
      } else {
        res.json({ message: "Note updated successfully" });
      }
    });
    app.put("/notes/task/update/:id", async (req, res) => {
      try {
        const noteId = req.params.id;
        const { updatedTasks } = req.body;
        // Log the received data for debugging
        console.log("Received data from client:", updatedTasks);

        // Ensure updatedTasks is not empty
        if (
          !updatedTasks ||
          !Array.isArray(updatedTasks) ||
          updatedTasks.length === 0
        ) {
          return res
            .status(400)
            .json({ error: "Invalid or empty updatedTasks array." });
        }

        // Update the tasks in the database
        const result = await notesCollection.updateOne(
          { _id: new ObjectId(noteId) },
          { $set: { Tasks: updatedTasks } }
        );

        // Log the result of the update operation
        console.log("MongoDB update result:", result);

        // Check if the document was found and updated
        if (result.matchedCount === 0) {
          return res.status(404).json({ error: "Note not found." });
        }

        // Send success response
        return res.json({ message: "Tasks updated successfully" });
      } catch (error) {
        // Handle any errors that occur during the update process
        console.error("Error updating tasks:", error);
        return res.status(500).json({ error: "Internal server error" });
      }
    });

    // Delete an event
    app.delete("/events/:id", async (req, res) => {
      try {
        const eventId = req.params.id;
        const result = await eventCollection.deleteOne({
          _id: new MongoClient.ObjectId(eventId),
        });
        if (result.deletedCount === 0) {
          res.status(404).json({ error: "Event not found." });
        } else {
          res.json({ message: "Event deleted successfully" });
        }
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.delete("/notes/:id", async (req, res) => {
      try {
        const noteId = req.params.id;
        const result = await notesCollection.deleteOne({
          _id: new ObjectId(noteId),
        });
        if (result.deletedCount === 0) {
          res.status(404).json({ error: "Note not found." });
        } else {
          res.json({ message: "Note deleted successfully" });
        }
      } catch (error) {
        res.status(500).json({ error: "Internal server error." });
      }
    });
    app.delete("/user/delete/:id", async (req, res) => {
      try {
        const userId = req.params.id;
        console.log(userId);
        const result = await userCollection.deleteOne({
          _id: new ObjectId(userId),
        });
        if (result.deletedCount === 0) {
          res.status(404).json({ error: "User not found." });
        } else {
          res.json({ message: "User deleted successfully" });
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
