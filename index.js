const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.USER}:${process.env.PASS}@cluster0.bijf7ad.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).send({ message: "UnAuthorized access" });
  }
  const token = authHeader.split(" ")[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.decoded = decoded;
    next();
  });
}

async function run() {
  try {
    await client.connect();

    const productCollection = client.db("life-saver").collection("products");
    const addproductsCollection = client
      .db("life-saver")
      .collection("addproducts");
    const userCollection = client.db("life-saver").collection("users");

    const verifyAdmin = async (req, res, next) => {
      const decodedEmail = req.decoded.email;

      const query = { email: decodedEmail };
      const requesterAccount = await userCollection.findOne(query);

      if (requesterAccount?.role === "admin") {
        return res.status(403).send({ message: "forbidden access" });
      }
      next();
    };

    app.post("/create-payment-intent", async (req, res) => {
      const product = req.body;
      const price = product.price;

      const amount = price * 100;

      // if (isNaN(amount)) {
      //   console.error("Invalid integer");
      // }
      // const paymentIntent = await stripe.paymentIntents.create({
      //   amount: amount,
      //   currency: "usd",
      //   payment_method_types: ["card"],
      // });
      // res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.put("/user/admin/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(
        { email: email },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: "24h" }
      );
      res.send({ result, token });
    });

    app.get("/user", verifyJWT, async (req, res) => {
      const users = await userCollection.find().toArray();
      res.send(users);
    });

    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user?.role === "admin";
      res.send({ admin: isAdmin });
    });

    app.delete("/user/:email", verifyJWT, verifyAdmin, async (req, res) => {
      const email = req.params.email;
      const filter = { email: email };
      const result = await userCollection.deleteOne(filter);
      res.send(result);
    });

    app.get("/product", async (req, res) => {
      const query = {};
      const cursor = productCollection.find(query).project({ name: 1 });
      const products = await cursor.toArray();
      res.send(products);
    });

    app.post("/addproduct", verifyJWT, verifyAdmin, async (req, res) => {
      const product = req.body;
      const result = await addproductsCollection.insertOne(product);
      res.send(result);
    });

    app.get("/addproduct", async (req, res) => {
      const product = await addproductsCollection.find().toArray();
      res.send(product);
    });

    app.delete("/addproduct/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const id = req.params;
      const filter = { _id: new ObjectId(id) };
      console.log(filter);
      const result = await addproductsCollection.deleteOne(filter);
      res.send(result);
    });
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
