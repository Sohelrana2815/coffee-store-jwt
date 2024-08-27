const express = require("express");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const cookieParser = require("cookie-parser");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

//middleware

app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173"],
    credentials: true,
  })
);
app.use(cookieParser());

const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5q2fm.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const uri = "mongodb://localhost:27017/";
console.log(uri);

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Middleware

const logger = async (req, res, next) => {
  // console.log("called", req.host, req.originalUrl);
  next();
};

// Verify token or authorization  check

const verifyToken = async (req, res, next) => {
  const token = req.cookies?.token;

  if (!token) {
    return res.status(401).send({ message: "unauthorized access" });
  }

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(401).send({ message: "unauthorized access" });
    }
    req.user = decoded;
    next();
  });
};

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();

    const coffeeCollection = client.db("coffees_DB").collection("coffees");
    const orderCollection = client.db("coffees_DB").collection("orders");

    // Auth Related data

    app.post("/jwt", logger, async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });
      res
        .cookie("token", token, {
          httpOnly: true,
          secure: false,
          sameSite: false,
        })
        .send({ success: true });
    });

    // coffees related data
    // get all data
    app.get("/coffees", logger, async (req, res) => {
      const result = await coffeeCollection.find().toArray();
      res.send(result);
    });

    //get specific data

    app.get("/coffees/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const options = {
        projection: { price: 1, photoURL: 1, name: 1 },
      };

      const result = await coffeeCollection.findOne(query, options);
      res.send(result);
    });

    // Order data find by email

    app.get("/orders", logger, verifyToken, async (req, res) => {
      // console.log(req.query?.email);
      console.log("valid token from decoded", req.user);
      if (req.query.email !== req.user.email) {
        return res.status(403).send({ message: "forbidden access" });
      }
      let query = {};
      if (req.query?.email) {
        query = { email: req.query?.email };
      }

      const result = await orderCollection.find(query).toArray();
      res.send(result);
    });

    // coffees order data post

    app.post("/orders", async (req, res) => {
      const order = req.body;
      // console.log(order);
      const result = await orderCollection.insertOne(order);
      res.send(result);
    });

    // order status update

    app.patch("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };

      const updatedStatus = req.body;
      // console.log(updatedStatus);

      const updatedDoc = {
        $set: {
          status: updatedStatus.status,
        },
      };
      const result = await orderCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    // delete a order data

    app.delete("/orders/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
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
  res.send("Coffee store server is running!");
});

app.listen(port, () => {
  console.log(`Coffee store server is running on port ${port}`);
});
