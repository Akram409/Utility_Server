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