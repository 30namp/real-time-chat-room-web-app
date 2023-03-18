const express = require('express');
const app = express();
const http = require('http').Server(app);
const WebSocket = require('ws');
const fs = require('fs');
const bodyParser = require('body-parser');
const { client } = require('websocket');
const port = 3000;

app.use(bodyParser.json());

function inArray(needle, haystack) {
    var length = haystack.length;
    for(var i = 0; i < length; i++) {
        if(haystack[i] == needle) return true;
    }
    return false;
}

function tryParseJSON(jsonString) {
    try 
    {
        const object = JSON.parse(jsonString);
        return object;
    } 
    catch(error) 
    {
        return null;
    }
}

function generateToken(length)
{
    const charset = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()';
    let token = '';
    for (let i = 0; i < length; i++) {
        token += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return token;
}

function out(situation, message)
{
    if(situation == 'error')
    {
        return {type: 'error', data: message};
    }
    else
    {
        return {type: 'success', data: message};
    }
}

function getOutType(obj)
{
    return obj.type;
}

function getOutData(obj)
{
    return obj.data;
}

function getNowDate()
{
    // Create a new Date object
    var now = new Date();

    // Get the current year, month, and day as separate variables
    var year = now.getFullYear();
    var month = now.getMonth() + 1; // getMonth() returns a zero-based index, so add 1
    var day = now.getDate();

    // Create a formatted date string in the "YYYY-MM-DD" format
    var dateString = year + "-" + month + "-" + day;

    return dateString;
}

function getNowTime()
{
    // Create a new Date object
    var now = new Date();

    // Get the current time as a string
    var timeString = now.toLocaleTimeString();

    return timeString;
}

function cerr(socket, msg) // * sending error msg to user & msg can be an object
{
    socket.send(JSON.stringify({
        type: 'error',
        data: msg,
    }));
}

function cout(socket, data) // * sending data to user & data can be an object
{
    socket.send(JSON.stringify({
        type: "success",
        data: data
    }));
}

class Client {

    constructor(username, password, token, ws = null)
    {
        this.token = (token ?? '39uh93ng98vndw054sdj');
        this.username = (username ?? 'user');
        this.password = (password ?? 'pass');
        this.ws = ws;
    }

    haveWebSocketConnection()
    {
        return (this.ws === null ? false : true);
    }

    removeWebSocketConnection()
    {
        this.setWebSocketConnection(null);
    }

    setWebSocketConnection(ws = null)
    {
        this.ws = ws;
    }

    getWebSocketConnection()
    {
        return this.ws;
    }

    getUsername()
    {
        return this.username;
    }

    getPassword()
    {
        return this.password;
    }

    getToken()
    {
        return this.token;
    }

    updateToken(token = null)
    {
        this.token = (token ?? this.token);
    }

    newMessage(msg)
    {
        if(this.haveWebSocketConnection())
            this.getWebSocketConnection().send(msg.makeJsonMessage());
        else
            return false;
        

        return true;
    }

}

class Clients {

    constructor()
    {
        this.clients = [];
    }

    setWebSocketConnection(username, socket)
    {
        for(let i = 0;i < this.clients.length;i++)
            if(this.clients[i].getUsername() == username)
                this.clients[i].setWebSocketConnection(socket);
    }

    removeWebSocketConnection(username)
    {
        for(let i = 0;i < this.clients.length;i++)
            if(this.clients[i].getUsername() == username)
                this.clients[i].removeWebSocketConnection();
    }

    loginClient(username, password)
    {
        let res = out('error', 'Invalid username or password');

        this.clients.forEach((client) => {
            if(client.getUsername() == username && client.getPassword() == password)
                res = out('success', client.getToken());
        });

        return res;
    }

    makeNewClient(username, password)
    {
        if(!this.usernameExistCheck(username))
        {
            let client = new Client(username, password, this.generateNewToken());
            this.clients.push(client);

            return out('success', client.getToken());
        }
        else
        {
            return out('error', 'Username already exists');
        }
    }

    usernameExistCheck(username)
    {
        let flag = false;

        this.clients.forEach((client) => {
            if(client.getUsername() == username)
                flag = true;
        });

        return flag;
    }

    updateClientToken(client)
    {
        for(let i = 0;i < this.clients.length;i++)
        {
            if(this.clients[i] == client)
            {
                this.clients[i].updateToken(this.generateNewToken());
                break;
            }
        }
    }

    checkTokenExist(token)
    {
        let flag = false;

        this.clients.forEach((client) => {
            if(client.getToken() == token)
                flag = true;
        });

        return flag;
    }

    getUsernameByToken(token)
    {
        for(let i = 0;i < this.clients.length;i++)
            if(this.clients[i].getToken() == token)
                return this.clients[i].getUsername();
    }

    generateNewToken()
    {
        let tokenLength = 12;

        let token = '';
        while(true)
        {
            token = generateToken(tokenLength);
            let flag = true;
            this.clients.forEach((client) => {
                if(client.getToken() == token)
                    flag = false;
            });
            if(flag)
                break;
        }

        return token;
    }

    getClientsUsernames()
    {
        let clientsList = [];
        
        this.clients.forEach((client) => {
            clientsList.push(client.getUsername());
        });

        return clientsList;
    }

    getClients()
    {
        return this.clients;
    }

}

let clients = new Clients();

class Message {

    constructor(from, text, chatRoomId)
    {

        this.sender = '';
        this.text = '';
        this.chatRoomId = '';
        this.date = '';
        this.time = '';

        this.setSenderUsername(from);
        this.setText(text);
        this.setChatRoom(chatRoomId);
        this.setTimeAndDate();
    }

    setTimeAndDate(datetime = null) // format "YYYY-MM-DD HH:ii:ss"
    {
        this.date = (datetime === null ? getNowDate() : datetime.split(' ')[0]);
        this.time = (datetime === null ? getNowTime() : datetime.split(' ')[1]);
    }

    getChatRoomId()
    {
        return this.chatRoomId;
    }

    getSenderUsername()
    {
        return this.sender;
    }

    getText()
    {
        return this.text;
    }

    getDate()
    {
        return this.date;
    }

    getTime()
    {
        return this.time;
    }

    makeJsonMessage()
    {
        return JSON.stringify({
            type: 'message',
            sender: this.getSenderUsername(),
            chatRoom: this.getChatRoomId(),
            text: this.getText(),
            time: this.getTime(),
            date: this.getDate()
        });
    }

    fillByObject(obj)
    {
        let needle = ['sender', 'chatRoom', 'text'];
        let flag = false;
        
        needle.forEach((c) => {
            if(typeof(obj[c]) === 'undefined')
                flag = true;
        });

        if(flag)
            return false;

        this.setSenderUsername(needle.sender);
        this.setChatRoom(needle.chatRoom);
        this.setText(needle.text);

        return true;
    }

    setSenderUsername(username)
    {
        this.sender = username;
    }

    setChatRoom(chatRoomId)
    {
        this.chatRoomId = chatRoomId;
    }

    setText(text)
    {
        this.text = text;
    }

}

class ChatRoom {
    
    constructor(clients) // Array of Usernames
    {
        this.clients = clients ?? [];
        this.date = getNowDate() + ' ' + getNowTime();
        this.messages = [];
    }

    getClientsUsernames()
    {
        return this.clients;
    }

    getClients() // returning by clients variable that defined above
    {
        let clientsList = [];

        for(let i = 0;i < clients.getClients().length;i++)
        {
            let client = clients.getClients()[i];
            if(inArray(client.getUsername(), this.getClientsUsernames()))
                clientsList.push(client);
        }

        return clientsList;
    }

    haveClient(username)
    {
        let clientUsernames = this.getClientsUsernames();
        
        for(let i = 0;i < clientUsernames.length;i++)
            if(clientUsernames[i] === username)
                return true;

        return false;
    }

    addClient(clients) // Array of strings OR string
    {
        if(typeof(clients) === 'string')
            clients = [clients];

        clients.forEach((client) => {
            this.clients.push(client);
        });
    }

    notifyClients(msg) // msg -> Message Class
    {
        this.getClients().forEach((client) => {
            if(client.getUsername() !== msg.getSenderUsername())
                client.newMessage(msg);
        });
    }

    newMessage(msg) // msg -> Message class
    {
        this.messages.push(msg);
        this.notifyClients(msg);
    }
}

class ChatRooms {

    constructor()
    {
        this.chatRooms = [];
    }

    makeNewChatRoom(clientsUsernames) // array of usernames
    {
        this.chatRooms = [...this.chatRooms, new ChatRoom(clientsUsernames)];
        return this.chatRooms.length - 1; // returning chatRoomId
    }

    addClientToChatRoom(client, chatRoomId) // client -> username || Array of usernames
    {
        if(chatRoomId < this.chatRooms.length)
        {
            this.chatRooms[chatRoomId].addClient(client);
            return true;
        }
        else
            return false;
    }

    getChatRooms()
    {
        return this.chatRooms;
    }

    newMessage(msg, chatRoomId) // Message Class
    {
        this.chatRooms[chatRoomId].newMessage(msg);
    }

    isValidChatRoomId(id)
    {
        if(id < this.getChatRooms().length)
            return true;
        return false;
    }

    getChatRoomsJson(username)
    {
        let res = [];

        this.getChatRooms().forEach((chatRoom, index) => {
            if(chatRoom.haveClient(username))
            {
                res.push({'id': index, 'users': chatRoom.getClientsUsernames()});
            }
        });

        return res;
    }

}

let chatRooms = new ChatRooms();

function authWebsocketMessage(webSocketMessage, socket) // webSocketMessage -> object
{
    if(typeof(webSocketMessage.type) !== 'undefined')
    {
        switch(webSocketMessage.type) {
            case ('login'):
                if(typeof(webSocketMessage.username) !== 'undefined' && typeof(webSocketMessage.password) !== 'undefined')
                {
                    let res = clients.loginClient(webSocketMessage.username, webSocketMessage.password);
                    if(getOutType(res) !== 'error')
                    {
                        socket.send(JSON.stringify({
                            token: getOutData(res)
                        }));
                        clients.setWebSocketConnection(webSocketMessage.username, socket);
                    }
                    else
                        cerr(socket, 'username or password was incorrect!');
                }
                else
                    cerr(socket, 'username or password was missing!');
                break;
            case ('signup'):
                if(typeof(webSocketMessage.username) !== 'undefined' && typeof(webSocketMessage.password) !== 'undefined')
                {
                    let res = clients.makeNewClient(webSocketMessage.username, webSocketMessage.password);
                    if(getOutType(res) !== 'error')
                    {
                        socket.send(JSON.stringify({
                            token: getOutData(res)
                        }));
                        clients.setWebSocketConnection(webSocketMessage.username, socket);
                    }
                    else
                        cerr(socket, 'this username already exist!');
                }
                else
                {
                    cerr(socket, 'username or password was missing!');
                }
                break;
            default:
                if(typeof(webSocketMessage.token) !== 'undefined')
                {
                    if(clients.checkTokenExist(webSocketMessage.token))
                        return webSocketMessage;
                    else
                        cerr(socket, 'you\'r token not working anymore!');
                }
                else
                    cerr(socket, 'login OR signup first, please!');
                break;
        }
    }

    return null;
}


// starting WebSocket server
const wsPort = 3000;
const server = new WebSocket.Server({ port: wsPort });
console.log(`WebSocket server started on port: ws://localhost:${wsPort}/`);

// ws connections handling
server.on('connection', (socket, request) => {

    console.log('new client connected!');

    let clientUsername = null;
    
    socket.on('message', (data) => {

        data = tryParseJSON(data);

        if(data === null || typeof(data.type) === 'undefined')
        {
            cerr(socket, 'message gonna be an object with \'type\' property!');
            return;
        }

        let res = authWebsocketMessage(data, socket);

        if(res === null)
        {
            return;
        }

        clientUsername = clients.getUsernameByToken(res.token);

        switch(res.type) {
            case('get-clients'):
                cout(socket, clients.getClientsUsernames());
                break;
            case('make-chatroom'): // * properties: {clients:["sinamp", "mr2", ...]}
                let clientsList = [clientUsername];

                if(typeof(res.clients) === 'object')
                    for(let i = 0;i < res.clients.length;i++)
                        if(clients.usernameExistCheck(res.clients[i]) && res.clients[i] !== clientUsername)
                            clientsList.push(res.clients[i]);

                let chatRoomId = chatRooms.makeNewChatRoom(clientsList);
                cout(socket, {chatRoomId: chatRoomId, clients: clientsList});

                break;
            case('get-chatrooms'):
                cout(socket, {'chat-rooms': chatRooms.getChatRoomsJson(clientUsername)});
                break;
            case('add-client-to-chatroom'): // * properties: {chatRoomId: 2, clients:["sinamp", "mr2", ...]}
                if(typeof(res.chatRoomId) === 'number' && typeof(res.clients) === 'object')
                {
                    if(chatRooms.isValidChatRoomId(res.chatRoomId))
                    {
                        if(chatRooms.getChatRooms()[res.chatRoomId].haveClient(clientUsername))
                        {
                            let clientsList = [];
                            clients.getClientsUsernames().forEach((username) => {
                                if(res.clients.contains(username) && username !== clientUsername && !chatRooms.getChatRooms()[res.chatRoomId].haveClient(username))
                                {
                                    clientsList.push(username);
                                }
                            });

                            if(clientsList.length)
                            {
                                chatRooms.addClientToChatRoom(clientsList, res.chatRoomId);
                                cout(socket, 'clients added to chatroom!');
                            }
                            else
                                cerr(socket, 'none of the clients was valid!');
                        }
                        else
                            cerr(socket, 'selected chatroom is not for this client');
                    }
                    else
                        cerr(socket, 'chatRoomId is not correct!');
                }
                else
                    cerr(socket, 'chatRoomId or clients property missing or is not in correct type!');
                break;
            case('message'): // * properties: {chatRoomId: 2, msg: 'hello world'}
                if(typeof(res.chatRoomId) === 'number' && typeof(res.msg) === 'string')
                {
                    if(chatRooms.isValidChatRoomId(res.chatRoomId))
                    {
                        if(chatRooms.getChatRooms()[res.chatRoomId].haveClient(clientUsername))
                        {
                            let msg = new Message(clientUsername, res.msg, res.chatRoomId);
                            chatRooms.newMessage(msg, res.chatRoomId);
                        }
                        else
                            cerr(socket, 'selected chatroom is not for this client');
                    }
                    else
                        cerr(socket, 'chatRoomId is not correct!');
                }
                else
                    cerr(socket, 'chatRoomId or clients property missing or is not in correct type!');
                break;
            default:
                socket.send(JSON.stringify(out('error', `message type property not exist! valid types: [get-clients, make-chatroom, get-chatrooms, add-client-to-chatroom, message]`)));
        }
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${(clientUsername ?? 'unkown')}`);

        if(clientUsername !== null)
            clients.removeWebSocketConnection(clientUsername);
    });

});