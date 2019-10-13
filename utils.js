const utils = {
    playerAvailable: (players, username) => {
        if(!username)
            return false;
        return players.find(player => player.username === username);
    },
    getRoomByPlayer: (rooms, username) => {
        rooms.map((room, i) => {
            if(room.players.find(player => player.username === username)) {
                return room;
            }
        });
        return null;
    }
}

module.exports = utils;