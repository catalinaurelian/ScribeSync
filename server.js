const { MongoClient } = require('mongodb');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname + '/'));

// Serve the index.html file for the root path
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

const uri = 'mongodb+srv://popacatalin2007:99admin11@cluster0.b5jzr88.mongodb.net';
MongoClient.connect(uri, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(client => {
    console.log('Connected to MongoDB');

    const collection = client.db('test').collection('documents');
    // Listen for socket connections
    io.on('connection', async (socket) => {
      console.log('User connected:', socket.id);
    
      // Prompt the user for a username
      socket.on('username', (username) => {
        console.log('Username set:', username);
        socket.username = username;
        console.log(socket.username);
      });
      // Get the list of available documents and send it to the client

      const cursor = await collection.find({}).toArray();
      socket.emit('documents', cursor);
    

      // Join the specified document room and get the current content for the user
      socket.on('join', async ({ documentId }) => {
        if (!documentId) {
          console.error('No documentId provided');
          return;
        }
        socket.join(documentId);
        const activeUsers = await io.in(documentId).fetchSockets().then((sockets) => {
          return sockets.map((socket) => {
            return socket.username.username;
          });
        });
        const activeUsersText = activeUsers.length > 0 ? activeUsers.join(', ') : 'none';
        console.log(`${socket.username.username} joined room ${documentId}! Sending activeUsersText: ${activeUsersText}`);
        
        socket.to(documentId).emit('active', activeUsersText);
        socket.emit('active', activeUsersText);    
        const doc = await collection.find({"documentId": documentId}).toArray();
        
        // console.log(`Updating: ${documentId}, ${doc[0].content}`);
        socket.emit('update', doc[0].content);
        
      });


      // Handle leave event
      socket.on('leave', async ({ documentId }) => {
        socket.leave(documentId);
        console.log(`User ${socket.username.username} left room ${documentId}`);
        
        const activeSockets = await io.in(documentId).fetchSockets();
        console.log(`Active sockets in room ${documentId}: ${activeSockets.map((socket) => socket.id)}`);
        
        const activeUsers = activeSockets.map((socket) => socket.username.username);
        const activeUsersText = activeUsers.length > 0 ? activeUsers.join(', ') : 'none';
        
        // console.log(`Active users: ${activeUsersText}`);
        socket.emit('active', activeUsersText);
        socket.to(documentId).emit('active', activeUsersText);
        
        
      });
      
      socket.on('create', async ({ documentId }) => {
        try {
          await collection.insertOne({ documentId, content: '' });
          const cursor = await collection.find({}).toArray();
          io.sockets.emit('documents', cursor);
        } catch (err) {
          console.error(err);
        }
      });
      

      // Handle changes to the text content
      socket.on('message', async ({ currentDocument, newSubstring }) => {
        console.log(`Received message ${newSubstring} in ${currentDocument}`);
        socket.to(currentDocument).emit('update', newSubstring);
        await collection.updateOne(
          { documentId: currentDocument },
          { $set: { content: newSubstring } }
        );
      });

    
      // Handle socket disconnections
      socket.on('disconnect', () => {
        
        console.log('User disconnected:', socket.id);
      });
    });
    const port = process.env.PORT || 3000;
    server.listen(port, () => {
      console.log(`Listening on port ${port}`);
    });
  })
  .catch(error => {
    console.error(error);
  });
