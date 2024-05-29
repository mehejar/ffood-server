const express = require('express')
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken')
require('dotenv').config()
const port = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.b9ejgk4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    await client.connect();


    const productsCollection = client.db('freshFoodDB').collection('products')
    const cartCollection = client.db('freshFoodDB').collection('cart')
    const userCollection = client.db('freshFoodDB').collection('user')
    const ordersCollection = client.db('freshFoodDB').collection('orders')
    const contactsCollection = client.db('freshFoodDB').collection('contacts')


    // JWT related API

    app.post('/jwt', async (req, res) => {
      const user = req.body
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
      res.send({ token })
    })

    // middlewares
    const verifyToken = (req, res, next) => {
      console.log("inside Varify token", req.headers.authorization)
      if (!req.headers.authorization) {
        return res.status(401).send({ message: 'forbidden access' })
      }
      const token = req.headers.authorization.split(' ')[1]
      if (!token) {

      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          return res.status(401).send({ message: 'forbidden access' })
        }
        req.decoded = decoded;
        next()
      })
      // next()
    }

    // Verify admin
    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;
      const query = { email: email };
      const user = await userCollection.findOne(query)
      const isAdmin = user?.role === 'admin';
      if (!isAdmin) {
        return res.status(403).send({ message: 'forbidden access' });
      }
      next()
    }




    // users Related API
    app.post('/user', async (req, res) => {
      const user = req.body;
      // insert email if user doesnt exit
      // you can do this many ways(1.email unq 2. upsert)
      const query = { email: user.email }
      const existingUser = await userCollection.findOne(query)

      if (existingUser) {
        return res.send({ message: 'user Already exist' })
      }

      const result = await userCollection.insertOne(user)
      res.send(result)
    })

    app.get('/user', verifyToken, verifyAdmin, async (req, res) => {
      // console.log(req.headers)
      const result = await userCollection.find().toArray()
      res.send(result)
    })

    // user access
    app.delete('/user/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await userCollection.deleteOne(query)
      res.send(result)
    })

    app.patch('/user/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          role: 'admin'
        }
      }
      const result = await userCollection.updateOne(filter, updatedDoc)
      res.send(result)

    })



    app.get('/user/admin/:email', verifyToken, async (req, res) => {
      const email = req.params.email
      if (email !== req.decoded.email) {
        return res.status(403).send({ message: 'unauthoried access' })
      }

      const query = { email: email }
      const user = await userCollection.findOne(query);
      let admin = false;
      if (user) {
        admin = user?.role === 'admin'
      }
      res.send({ admin })
    })

    // all products

    app.post('/products', async (req, res) => {
      const product = req.body;
      const result = await productsCollection.insertOne(product);
      res.send(result);
    })

    app.get('/products', async (req, res) => {
      const result = await productsCollection.find().toArray();
      res.send(result)
    })
    app.get('/products/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await productsCollection.findOne(query)
      res.send(result)
    })

    app.patch('/products/:id', verifyToken, verifyAdmin, async (req, res) => {
      const product = req.body
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          name: product.name,
          category: product.category,
          price: product.price,
          description: product.recipe,
          sub_category: product.sub_category,
          weight: product.weight,
          image: product.image
        }
      }

      const result = await productsCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    app.delete('/products/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await productsCollection.deleteOne(query);
      res.send(result)
    })

    // cart store
    app.post('/cart', async (req, res) => {
      const cartItem = req.body;
      const result = await cartCollection.insertOne(cartItem);
      res.send(result);
    })

    app.patch('/cart/:id', verifyToken, async (req, res) => {
      const amount = req.body
      const id = req.params.id
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {
          quantity: amount.totalQuantity,
          subtotal: amount.subtotal
         
        }
      }

      const result = await cartCollection.updateOne(filter, updatedDoc)
      res.send(result)
    })

    // orders collection-----------------------------------------
    app.post('/orders', async (req, res) => {
      const order = req.body;
      const result = await ordersCollection.insertOne(order);

      const query = {
        _id: {
          $in: order.cartId.map(id => new ObjectId(id))
        }
      }
      const deleteResult = await cartCollection.deleteMany(query)

      res.send({ result, deleteResult });
    })

    // =====status===========
    app.patch('/orders/:id', verifyToken, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) }
      const updatedDoc = {
        $set: {

          status: 'confirm'
        }
      }
      const result = await ordersCollection.updateOne(filter, updatedDoc)
      res.send(result)

    })

    app.get('/orders/:email', verifyToken, async (req, res) => {
      const query = { email: req.params.email }
      if (req.params.email !== req.decoded.email) {
        return res.status(403).send({ message: 'Forbidden' })
      }
      const result = await ordersCollection.find(query).toArray()
      res.send(result)
    })

    app.get('/orders', async (req, res) => {
      const result = await ordersCollection.find().toArray()
      res.send(result)
    })

    // --------------Contacts--------------
    app.post('/contacts', async (req, res) => {
      const order = req.body;
      const result = await contactsCollection.insertOne(order);

      res.send(result);
    })



    // load user based data 
    app.get('/cart', async (req, res) => {
      const email = req.query.email;
      const query = { email: email }
      result = await cartCollection.find(query).toArray()
      res.send(result)
    })

    // User can delte item
    app.delete('/cart/:id', async (req, res) => {
      const id = req.params.id
      const query = { _id: new ObjectId(id) }
      const result = await cartCollection.deleteOne(query);
      res.send(result)
    })


    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// -------------

app.get('/', (req, res) => {
  res.send('Fresh Food Deliverring')
})

app.listen(port, () => {
  console.log(`Fresh Food is Running ${port}`)
});