const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// middleware
app.use(cors());
app.use(express.json());

const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@Swipe Defend.hwqhwvm.mongodb.net/?retryWrites=true&w=majority`;


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
        // await client.connect();

        const userCollection = client.db(`${process.env.DB_NAME}`).collection("users");
        const reviewCollection = client.db(`${process.env.DB_NAME}`).collection("reviews");
        const paymentCollection = client.db(`${process.env.DB_NAME}`).collection("payments");
        const contactCollection = client.db(`${process.env.DB_NAME}`).collection("contact");
        const scoreHistoryCollection = client.db(`${process.env.DB_NAME}`).collection("scoreHistory");

        // Middleware for verifying token and admin
        // jwt related api
        app.post('/jwt', async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        // use verify token before verify admin
        const verifyToken = (req, res, next) => {
            // console.log('inside verify token', req.headers.authorization);
            if (!req.headers.authorization) {
                return res.status(401).send({ message: 'unauthorized access' });
            }
            const token = req.headers.authorization.split(' ')[1];
            jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
                if (err) {
                    return res.status(401).send({ message: 'unauthorized access' })
                }
                req.decoded = decoded;
                next();
            })
        }

        // use verify admin after verifyToken
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            const isAdmin = user?.role === 'admin';
            if (!isAdmin) {
                return res.status(403).send({ message: 'forbidden access' });
            }
            next();
        }
        // Middleware for verifying token and admin ends


        // users related apis
        // get user by email
        app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
            const result = await userCollection.find().toArray();
            res.send(result);
        });

        // get a single user by email
        app.get('/singleuser/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const user = await userCollection.findOne(query);
            res.send(user);
        })

        // get user by email (for profile) 
        app.get('/users/admin/:email', verifyToken, async (req, res) => {
            const email = req.params.email;

            if (email !== req.decoded.email) {
                return res.status(403).send({ message: 'forbidden access' })
            }

            const query = { email: email };
            const user = await userCollection.findOne(query);
            let admin = false;
            if (user) {
                admin = user?.role === 'admin';
            }
            res.send({ admin });
        })

        // post user (for signup)
        app.post('/users', async (req, res) => {
            const user = req.body;
            // insert email if user doesnt exists: 
            // you can do this many ways (1. email unique, 2. upsert 3. simple checking)
            const query = { email: user.email }
            const existingUser = await userCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists', insertedId: null })
            }
            const result = await userCollection.insertOne(user);
            res.send(result);
        });

        // make the user admin (for admin creation)
        app.patch('/users/admin/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    role: 'admin'
                }
            }
            const result = await userCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        // delete users (for admin deletion)
        app.delete('/users/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await userCollection.deleteOne(query);
            res.send(result);
        })

        // Review Related Apis
        try {
            app.get('/reviews', async (req, res) => {
                const result = await reviewCollection.find().toArray();
                res.send(result);
            })

            app.post('/reviews', async (req, res) => {
                const review = req.body;
                const result = await reviewCollection.insertOne(review);
                res.send(result);
            })

            app.patch('/reviews/:id', async (req, res) => {
                const id = req.params.id;
                const filter = { _id: new ObjectId(id) };
                const updatedDoc = {
                    $set: {
                        name: req.body.name,
                        details: req.body.details,
                        rating: req.body.rating,
                    }
                }
                const result = await reviewCollection.updateOne(filter, updatedDoc);
                res.send(result);
            })

            app.delete('/reviews/:id', async (req, res) => {
                const id = req.params.id;
                const query = { _id: new ObjectId(id) }
                const result = await reviewCollection.deleteOne(query);
                res.send(result);
            })
        }
        catch (err) {
            console.log(err);
        }

        // ----------------- contact related apis ----------------- 
        app.post('/contact', async (req, res) => {
            const contact = req.body;
            const result = await contactCollection.insertOne(contact);
            res.send(result);
        })

        app.get('/contact', verifyToken, verifyAdmin, async (req, res) => {
            const result = await contactCollection.find().toArray();
            res.send(result);
        })

        app.patch('/contact/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updatedDoc = {
                $set: {
                    status: req.body.status
                }
            }
            const result = await contactCollection.updateOne(filter, updatedDoc);
            res.send(result);
        })

        app.delete('/contact/:id', verifyToken, verifyAdmin, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) }
            const result = await contactCollection.deleteOne(query);
            res.send(result);
        })
        // ----------------- contact related apis ----------------- 

        // ----------------- Payment related apis -----------------
        app.post('/create-payment-intent', async (req, res) => {
            const { price } = req.body;
            const amount = parseInt(price * 100);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ["card"],
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        app.get('/payments', verifyToken, verifyAdmin, async (req, res) => {
            const result = await paymentCollection.find().toArray();
            res.send(result);
        })

        app.get('/payments/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await paymentCollection.find(query).toArray();
            res.send(result);
        })


        app.post('/payments', async (req, res) => {
            const payment = req.body;
            const paymentResult = await paymentCollection.insertOne(payment);
            const query = {
                _id: new ObjectId(payment.propertyId)
            };

            res.send({ paymentResult });
        })

        // ----------------- Score History related apis -----------------

        app.get('/scoreHistory', verifyToken, verifyAdmin, async (req, res) => {
            const result = await scoreHistoryCollection.find().toArray();
            res.send(result);
        })

        app.get('/scoreHistory/:email', verifyToken, async (req, res) => {
            const email = req.params.email;
            const query = { email: email };
            const result = await scoreHistoryCollection.find(query).toArray();
            res.send(result);
        })

        app.post('/scoreHistory', verifyToken, async (req, res) => {
            const scoreHistory = req.body;
            const result = await scoreHistoryCollection.insertOne(scoreHistory);
            res.send(result);
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


app.get('/', (req, res) => {
    res.send('Swipe Defend is sitting')
})

app.listen(port, () => {
    console.log(`Swipe Defend is sitting on port ${port}`);
})


// create secure environment variables
// require("crypto").randomBytes(64).toString("hex");
