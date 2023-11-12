const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
require('dotenv').config();

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

		// Get all menu
		app.get('/menu', async (req, res) => {
			const query = {};
			const result = await menuCollection.find(query).toArray();
			res.send(result);
		});
		// Get all reviews
		app.get('/reviews', async (req, res) => {
			const query = {};
			const result = await reviewCollection.find(query).toArray();
			res.send(result);
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
