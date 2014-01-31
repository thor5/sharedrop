FileDrop.IndexController = Ember.ArrayController.extend({
    needs: ['application'],

    user: Ember.computed.alias('controllers.application.user'),
    room: null,

    init: function () {
        // Connect to PeerJS server first,
        // so that we already have peer ID when later joining a room.
        this.set('_peer', new FileDrop.WebRTC());

        // Handle room events
        $.subscribe('connected.room', this._onRoomConnected.bind(this));
        $.subscribe('user_list.room', this._onRoomUserList.bind(this));
        $.subscribe('user_added.room', this._onRoomUserAdded.bind(this));
        $.subscribe('user_changed.room', this._onRoomUserChanged.bind(this));
        $.subscribe('user_removed.room', this._onRoomUserRemoved.bind(this));

        // Handle peer events
        $.subscribe('connected.server.peer', this._onPeerServerConnected.bind(this));
        $.subscribe('connected.p2p.peer', this._onPeerP2PConnected.bind(this));
        $.subscribe('disconnected.p2p.peer', this._onPeerP2PDisconnected.bind(this));
        $.subscribe('info.p2p.peer', this._onPeerP2PFileInfo.bind(this));
        $.subscribe('response.p2p.peer', this._onPeerP2PFileResponse.bind(this));
        $.subscribe('file.p2p.peer', this._onPeerP2PFileTransfer.bind(this));

        this._super();
    },

    _onRoomConnected: function (event, data) {
        var user = this.get('user');

        data.label = 'You (' + data.uuid + ')';
        user.setProperties(data);
    },

    _onRoomUserList: function (event, data) {
        // Add all peers to the list and
        // initiate p2p connection to every one of them.
        var _peer = this.get('_peer');

        data.forEach(function (attrs) {
            var peer = FileDrop.Peer.create(attrs);

            this.pushObject(peer);
            _peer.connect(peer.get('peer.id'));
        }.bind(this));
    },

    _onRoomUserAdded: function (event, data) {
        var user = this.get('user'),
            peer;

        if (user.get('uuid') !== data.uuid) {
            // Add peer to the list of peers in the room
            peer = FileDrop.Peer.create(data);
            this.pushObject(peer);
        }
    },

    _onRoomUserChanged: function (event, data) {
        var peer = this.findBy('uuid', data.uuid);
        if (peer) peer.setProperties(data);
    },

    _onRoomUserRemoved: function (event, data) {
        var peer = this.findBy('uuid', data.uuid);
        this.removeObject(peer);
    },

    _onPeerServerConnected: function (event, data) {
        var user = this.get('user');

        user.setProperties({isConnected: true});
        user.get('peer').setProperties({id: data.id});

        // Join room and broadcast user attributes
        var room = new FileDrop.Room();
        room.join(user.serialize());
        this.set('room', room);
    },

    _onPeerP2PConnected: function (event, data) {
        var connection = data.connection,
            peer = this.findBy('peer.id', connection.peer);

        peer.set('peer.connection', connection);
    },

    _onPeerP2PDisconnected: function (event, data) {
        var connection = data.connection,
            peer = this.findBy('peer.d', connection.peer);

        if (peer) peer.set('peer.connection', null);
    },

    _onPeerP2PFileInfo: function (event, data) {
        console.log('Peer:\t Received file info', data);

        var _peer = this.get('_peer'),
            connection = data.connection,
            peer = this.findBy('peer.id', connection.peer),
            info = data.info,
            response;

        response = window.confirm('"' + peer.uuid + '"' + ' wants to send you "' + info.name + '".');
        _peer.sendFileResponse(connection, response);
    },

    _onPeerP2PFileResponse: function (event, data) {
        console.log('Peer:\t Received file response', data);

        var _peer = this.get('_peer'),
            connection = data.connection,
            peer = this.findBy('peer.id', connection.peer),
            response = data.response,
            file;

        if (response) {
            file = peer.get('peer.file');
            _peer.sendFile(connection, file);
        }

        // Remove "cached" file for that peer now that we have a response
        peer.set('peer.file', null);
    },

    _onPeerP2PFileTransfer: function (event, data) {
        console.log('Peer:\t Received file', data);

        var file = data.file,
            dataView, dataBlob, dataUrl;

        if (file.data.constructor === ArrayBuffer) {
            dataView = new Uint8Array(file.data);
            dataBlob = new Blob([dataView]);
            dataUrl = window.URL.createObjectURL(dataBlob);

            // Save received file
            var a = document.createElement('a');
            a.setAttribute('download', file.name);
            a.setAttribute('href', dataUrl);
            document.body.appendChild(a);
            a.click();
        }
    },

    // Broadcast user's email changes to other peers
    userEmailDidChange: function () {
        var email = this.get('user.email'),
            room  = this.get('room');

        if (room) room.update({email: email});
    }.observes('user.email')
});
