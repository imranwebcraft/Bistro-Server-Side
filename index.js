const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const port = process.env.PORT || 5000;
// Express app variable
const app = express();

// middleware
app.use(cors());
app.use(express.json());

// MongoDB

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.7o1h45b.mongodb.net/?retryWrites=true&w=majority`;
// Create a MongoClient
const client = new MongoClient(uri, {
	serverApi: {
		version: ServerApiVersion.v1,
		strict: true,
		deprecationErrors: true,
	},
});

async function run() {
	try {
		// Connect
		await client.connect();

		// Collections
		const menuCollection = client.db('bistroDB').collection('menu');
		const reviewCollection = client.db('bistroDB').collection('reviews');
		const cartCollection = client.db('bistroDB').collection('carts');
		const userCollection = client.db('bistroDB').collection('users');
		const paymentCollection = client.db('bistroDB').collection('payments');

		// MiddleWare

		// ----------------- TOKEN VERIFY ---------------------//

		const verifyToken = (req, res, next) => {
			// Check is there authorization header
			// if not???
			if (!req?.headers?.authorization) {
				return res.status(401).send({ message: 'unAuthorize access' });
			}

			// if there, get the token
			const token = req.headers?.authorization.split(' ')[1];

			jwt.verify(token, process.env.ACCESS_TOKE_SECRET, (err, decoded) => {
				if (err) {
					res.status(401).send({ message: 'unAuthorize access' });
				}
				req.user = decoded;
				next();
			});
		};

		// use verify admin after verify token
		// ------------------ ADmin Verify ---------------------//

		const verifyAdmin = async (req, res, next) => {
			// Token ta jar se admin kina check korbo
			const email = req.user.email;
			const query = { email: email };
			const user = await userCollection.findOne(query);
			const isAdmin = user?.role === 'admin';
			if (!isAdmin) {
				return res
					.status(403)
					.send({ message: 'forbiden access from verify admin' });
			}
			next();
		};

		// ----------JWT related api------------ //

		app.post('/jwt', async (req, res) => {
			const user = req.body;
			const token = jwt.sign(user, process.env.ACCESS_TOKE_SECRET, {
				expiresIn: '12h',
			});
			res.send({ token });
		});

		// ----------Get ADMIN api------------ //

		app.get('/users/admin/:email', verifyToken, async (req, res) => {
			// Problem: Unable to get email from front end, for this reason ultimately verify token midddleware unable to verify the token
			// Now solve with render the dashboard within a private route, that will help the useAdmin route to take time to get the user email.
			const email = req.params.email;
			if (email !== req.user.email) {
				// Do something
				return res.status(403).send({
					message: 'forbiden access',
				});
			}
			// Chec user role to the database
			const query = { email: email };
			// Ei email diye user take khuje ber korbo
			const user = await userCollection.findOne(query);
			let isAdmin = false;
			if (user?.role === 'admin') {
				isAdmin = true;
			}
			res.send({ isAdmin });
		});

		// ----------USER related api------------ //

		// Get all users data from database
		app.get('/users', verifyToken, verifyAdmin, async (req, res) => {
			// console.log(req.headers);
			const query = {};
			const result = await userCollection.find(query).toArray();
			res.send(result);
		});

		// 💀💀Delete single users💀💀💀
		app.delete('/users/:id', async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await userCollection.deleteOne(query);
			res.send(result);
		});

		// Make a user admin
		app.patch('/users/admin/:id', async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					role: 'admin',
				},
			};
			const result = await userCollection.updateOne(filter, updateDoc);
			res.send(result);
		});

		// Post user info to database
		app.post('/users', async (req, res) => {
			const user = req.body;
			// Insert user info if email doesn't exist to the database
			// There are many ways to do that--- ( 1. email unique 2. upsert 3. simple chekcing )
			// Check
			const query = { email: user?.email };
			const existingUser = await userCollection.findOne(query);
			if (existingUser) {
				return res.send({
					message: 'User already in Database',
					insertedId: null,
				});
			}
			// if user does't exist then insert use info to the database
			const result = await userCollection.insertOne(user);
			res.send(result);
		});

		// ----------Payment related api------------ //

		app.post('/create-payment-intent', async (req, res) => {
			const { price } = req.body;
			const ammount = parseInt(price * 100);
			const paymentIntent = await stripe.paymentIntents.create({
				amount: ammount,
				currency: 'usd',
				payment_method_types: ['card'],
			});

			res.send({
				clientSecret: paymentIntent.client_secret,
			});
		});

		// Save payment data to the server and delete cart item data using deleteMany mongoDB function

		app.post('/payments', async (req, res) => {
			const payment = req.body;
			const paymentResult = await paymentCollection.insertOne(payment);
			// Now delete theose items from the cart
			const query = {
				_id: {
					$in: payment.cartIds.map((id) => new ObjectId(id)),
				},
			};
			const deleteResult = await cartCollection.deleteMany(query);
			res.send({ paymentResult, deleteResult });
		});

		// Get payment information using user email address
		app.get('/payments/:email', verifyToken, async (req, res) => {
			const email = req.params.email;
			const tokenEmial = req.user.email;
			if (email !== tokenEmial) {
				res.status(403).send({ message: 'forbidden access' });
			}
			const query = { email: email };
			const result = await paymentCollection.find(query).toArray();
			res.send(result);
		});

		// ----------Cart related api------------ //

		//get cart data by specific user
		app.get('/carts', async (req, res) => {
			const email = req.query.email;
			let query = {};
			if (email) {
				query = { email: email };
			}
			const result = await cartCollection.find(query).toArray();
			res.send(result);
		});

		// Store carted product item to the database
		app.post('/carts', async (req, res) => {
			const cartItem = req.body;
			const result = await cartCollection.insertOne(cartItem);
			res.send(result);
		});

		// Delete an cart item
		app.delete('/carts/:id', async (req, res) => {
			const id = req.params.id;
			const filter = { _id: new ObjectId(id) };
			const result = await cartCollection.deleteOne(filter);
			res.send(result);
		});

		// ----------Menu related api------------ //

		// Get all menu
		app.get('/menu', async (req, res) => {
			const query = {};
			const result = await menuCollection.find(query).toArray();
			res.send(result);
		});

		// Get a specific menu item
		app.get('/menu/:id', async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await menuCollection.findOne(query);
			res.send(result);
		});

		// Post a new menu Item
		app.post('/menu', verifyToken, verifyAdmin, async (req, res) => {
			const menuItem = req.body;
			const result = await menuCollection.insertOne(menuItem);
			res.send(result);
		});

		// Patch a specifi menu detais
		app.patch('/menu/:id', async (req, res) => {
			const id = req.params.id;
			const menu = req.body;
			const filter = { _id: new ObjectId(id) };
			const updateDoc = {
				$set: {
					name: menu.name,
					recipe: menu.recipe,
					image: menu.image,
					category: menu.category,
					price: menu.price,
				},
			};
			const result = await menuCollection.updateOne(filter, updateDoc);
			res.send(result);
		});

		// 💀💀Delete a menu item 💀💀
		app.delete('/menu/:id', async (req, res) => {
			const id = req.params.id;
			const query = { _id: new ObjectId(id) };
			const result = await menuCollection.deleteOne(query);
			res.send(result);
		});

		// ----------Review related api------------ //

		// Get all reviews
		app.get('/reviews', async (req, res) => {
			const query = {};
			const result = await reviewCollection.find(query).toArray();
			res.send(result);
		});

		// ----------------- Stats / AnyLytics Related Api ------------------

		app.get('/admin-stats', verifyToken, verifyAdmin, async (req, res) => {
			const users = await userCollection.estimatedDocumentCount();
			const menuItems = await menuCollection.estimatedDocumentCount();
			const orders = await paymentCollection.estimatedDocumentCount();

			// ----------------- Bangle System ------------
			// const payments = await paymentCollection.find().toArray();
			// const revenue = payments.reduce((total, item) => total + item.price, 0);

			//  --------------- Best Way -----------------

			// This result will return an array of object called totalRevenue
			const result = await paymentCollection
				.aggregate([
					{
						$group: {
							_id: null, // null mean ami sob gulo ke bujhasci, specific id dile specific filed bujhaito
							totalRevenue: { $sum: '$price' },
						},
					},
				])
				.toArray();

			const revenue =
				result.length > 0 ? result[0].totalRevenue : 'No payment Found';

			res.send({
				users,
				menuItems,
				orders,
				revenue,
			});
		});

		// Send a ping
		await client.db('admin').command({ ping: 1 });
		console.log(
			'Pinged your deployment. You successfully connected to MongoDB!'
		);
	} finally {
		// await client.close();
	}
}
run().catch(console.dir);

// Simple check
app.get('/', (req, res) => {
	res.send('Boss is sitting');
});

app.listen(port, () => {
	console.log(`Boss is litening on port ${port}`);
});
