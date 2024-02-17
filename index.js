const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcrypt");
const port = process.env.PORT || 5000;
const crypto = require("crypto");
const multer = require("multer");
const path = require("path");

// Middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { convertToPdf } = require("./converter/convertToPdf");
const { ImageToPdf } = require("./converter/ImageToPdf");
const { combinePDFs } = require("./converter/combinePDFs");

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

    // Middleware to verify JWT token
    const verifyToken = (req, res, next) => {
      // Get the token from the request headers or body
      const token = req.headers.authorization?.split(" ")[1] || req.body.token;

      if (!token) {
        return res.status(401).json({ error: "No token provided" });
      }

      // Verify the token
      jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
          return res.status(403).json({ error: "Invalid token" });
        }
        // Token is valid, attach decoded user information to the request object
        req.user = decoded;
        next(); // Call the next middleware
      });
    };


    // Use unique indexes for username and email to prevent duplicates
    await userCollection.createIndex(
      { username: 1 },
      { unique: true, background: true }
    );
    await userCollection.createIndex(
      { email: 1 },
      { unique: true, background: true }
    );

    // POST
    app.post("/signup", async (req, res) => {
      try {
        const { username, email, password, role } = req.body;
        console.log(req.body);
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
            const newUser = {
              username,
              email,
              password: hashedPassword,
              role: role,
            };

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

    // Route to verify token
    app.post("/verifyToken", verifyToken, (req, res) => {
      res.status(200).json({ message: "Token is valid" });
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
    app.post("/user", async (req, res) => {
      const user = req.body;
      console.log(user);
      const query = { email: user.email };
      const existingUser = await userCollection.findOne(query);

      if (existingUser) {
        return res.send({ message: "user is already exists" });
      }
      const result = await userCollection.insertOne(user);
      res.send(result);
    });

    // Get
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

    // Update
    app.put("/user/update/:id", async (req, res) => {
      try {
        const userId = req.params.id;
        const { newPassword } = req.body;

        // Hash the new password
        const hashedPassword = await bcrypt.hash(newPassword, 10);

        // Update the user's password in the database
        const result = await userCollection.updateOne(
          { _id: new ObjectId(userId) },
          { $set: { password: hashedPassword } }
        );

        if (result.matchedCount === 0) {
          res.status(404).json({ error: "User not found." });
        } else {
          res.json({ message: "Password updated successfully" });
        }
      } catch (error) {
        console.error("Error updating password:", error);
        res.status(500).json({ error: "Internal server error" });
      }
    });
    app.put("/notes/update/:id", async (req, res) => {
      const noteId = req.params.id;
      console.log(noteId);
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
      console.log(result);
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
        // console.log("Received data from client:", updatedTasks);

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
        // console.log("MongoDB update result:", result);

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

    // Delete
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
        // console.log(userId);
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

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    // console.log(file.mimetype);
    return cb(null, "./public/allFile");
  },
  filename: function (req, file, cb) {
    return cb(null, `${file.originalname}`);
  },
});

const upload = multer({ storage });

app.post("/converter/upload", upload.single("file"), async (req, res) => {
  try {
    const { path, mimetype } = req.file;
    if (
      mimetype ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
      mimetype === "application/msword"
    ) {
      // Convert DOCX to PDF using the module
      const pdfFileName = await convertToPdf(path);
      console.log(pdfFileName);
      res.status(200).json({ message: "Conversion successful", pdfFileName });
    } else if (mimetype.startsWith("image/")) {
      // Convert image to PDF using the imageToPdf function
      const pdfFileName = await ImageToPdf(path);
      res.status(200).json({ message: "Conversion successful", pdfFileName });
    } else {
      res.status(400).json({ error: "Unsupported file format" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/converter/upload/download/DocxORImage", (req, res) => {
  res.download(path.resolve("./outputfile.pdf"));
});

const multiPdf = upload.fields([
  { name: "file1", maxCount: 10 },
  { name: "file2", maxCount: 10 },
]);

app.post("/converter/upload/combine", multiPdf, async (req, res) => {
  try {
    const { file1, file2 } = req.files;
    if (!file1 || !file2) {
      return res.status(400).json({ error: "Both files are required" });
    }

    const firstPdfPath = file1[0].path;
    const secondPdfPath = file2[0].path;
    const outputPath = "./public/combined.pdf"; // Output path for the combined PDF

    // Combine the uploaded PDF files
    await combinePDFs(firstPdfPath, secondPdfPath, outputPath);

    // Send the combined PDF as a response
    res.status(200).download(outputPath, "combined.pdf", (err) => {
      if (err) {
        console.error("Error downloading combined PDF:", err);
        res.status(500).json({ error: "Internal server error" });
      } else {
        console.log("Combined PDF sent successfully");
        // Optionally, you can delete the temporary PDF files after sending the response
        // fs.unlinkSync(firstPdfPath);
        // fs.unlinkSync(secondPdfPath);
        // fs.unlinkSync(outputPath);
      }
    });
  } catch (error) {
    console.error("Error combining PDFs:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});
app.get("/converter/upload/download/Combine", (req, res) => {
  res.download(path.resolve("./public/combined.pdf"));
});

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
