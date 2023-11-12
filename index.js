const express = require('express');
const cors = require('cors');
require('dotenv').config();

const port = process.env.PORT || 5000;
// Express app variable
const app = express();

// middleware
app.use(cors());
app.use(express.json());

// Simple check
app.get('/', (req, res) => {
	res.send('Boss is sitting');
});

app.listen(port, () => {
	console.log(`Boss is litening on port ${port}`);
});
