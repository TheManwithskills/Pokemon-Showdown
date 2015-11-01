/* A small script that deals with custom avatars. Please report any bugs to me~
~SilverTactic/Siiilver
*/
var fs = require('fs');
var request = require('request');
var path = require('path');
 
function loadAvatars() {
        var formatList = ['.png', '.gif', '.bmp', '.jpeg', '.jpg'];
        var avatarList = fs.readdirSync('config/avatars');
        for (var i = 0; i < avatarList.length; i++) {
                var name = path.basename(avatarList[i], path.extname(avatarList[i]));
                if (Config.customavatars[name] || formatList.indexOf(path.extname(avatarList[i])) === -1) continue;
                Config.customavatars[name] = avatarList[i];
        }
}
loadAvatars();
 
if (Config.watchconfig) {
        fs.watchFile(path.resolve(__dirname, 'config/config.js'), function (curr, prev) {
                if (curr.mtime <= prev.mtime) return;
                try {
                        delete require.cache[require.resolve('./config/config.js')];
                        global.Config = require('./config/config.js');
                        if (global.Users) Users.cacheGroupData();
                        console.log('Reloaded config/config.js');
                        loadAvatars();
                } catch (e) {}
        });
}
 
var cmds = {
        '': 'help',
        help: function (target, room, user) {
                if (!this.canBroadcast()) return;
                return this.sendReplyBox('<b>Custom Avatar commands</b><br>' +
                        'All commands require ~ unless specified otherwise.<br><br>' +
                        '<li>/setavatar <em>User</em>, <em>URL</em> - Sets the specified user\'s avatar to the specified image link.' +
                        '<li>/removeavatar <em>User</em> - Delete\'s the specified user\'s custom avatar.' +
                        '<li>/moveavatar <em>User 1</em>, <em>User 2</em> - Moves User 1\'s custom avatar to User 2.'
                );
        },
 
        add: 'set',
        forceset: 'set',
        set: function (target, room, user, connection, cmd) {
                var User;
                if (!this.can('hotpatch')) {
                        //You'll have to set a *user.boughtAvatar = true;* statement somewhere in your shop code when a user buys a custom avatar
                        if (cmd === 'forceset') return false;
                        if (!target || !target.trim()) return this.sendReply('|html|/ca ' + cmd + ' <em>URL</em> - Sets your custom avatar to the specified image.');
                        if (!user.boughtAvatar) return this.sendReply('You need to buy a custom avatar from the shop before using this command.');
 
                        target = target.trim();
                        User = user;
                } else {
                        if (!target || !target.trim()) return this.sendReply('|html|/ca ' + cmd + ' <em>User</em>, <em>URL</em> - Sets the specified user\'s custom avatar to the specified image.');
                        target = this.splitTarget(target);
                        var targetUser = Users.getExact(this.targetUsername);
                        if (!target || !target.trim()) return this.sendReply('|html|/ca ' + cmd + ' <em>User</em>, <em>URL</em> - Sets the specified user\'s custom avatar to the specified image.');
                        if (!targetUser && cmd !== 'forceset') return this.sendReply('User ' + this.targetUsername + ' is offline. Use the command "forceset" instead of "' + cmd + '" to set their custom avatar.');
                        target = target.trim();
                        User = targetUser || this.targetUsername;
                }
                var avatars = Config.customavatars;
                var formatList = ['.png', '.jpg', '.gif', '.bmp', '.jpeg'];
                var format = path.extname(target);
                if (formatList.indexOf(format) === -1) return this.sendReply('The format of the selected avatar is not supported. The allowed formats are: ' + formatList.join(', ') + '.');
                if (target.indexOf('https://') === 0) target = 'http://' + target.substr(8);
                else if (target.indexOf('http://') !== 0) target = 'http://' + target;
 
                //We don't need to keep the user's original avatar
                if (avatars[toId(User)]) fs.unlinkSync('config/avatars/' + avatars[toId(User)]);
                var self = this;
                request.get(target).on('error', function () {
                        return self.sendReply("The selected avatar doesn\'t exist. Try picking a different one.");
                }).on('response', function (response) {
                        if (response.statusCode == 404) return self.sendReply("The selected avatar is unavailable. Try picking a different one.");
                        var img = toId(User) + format;
                        if (Users.getExact(User)) {
                                delete User.avatar;
                                User.avatar = img;
                        }
                        avatars[toId(User)] = img;
                        var their = (toId(User) === user.userid ? User.name + '\'s' : 'Your');
                        self.sendReply('|html|' + their + ' custom avatar has been set to <br><div style = "width: 80px; height: 80px; overflow: hidden;"><img src = "' + target + '" style = "max-height: 100%; max-width: 100%"></div>');
                        response.pipe(fs.createWriteStream('config/avatars/' + img));
                });
        },
       
        remove: 'delete',
        'delete': function (target, room, user, connection, cmd) {
                if (!target || !target.trim()) return this.sendReply('|html|/ca ' + cmd + ' <em>User</em> - Deletes the specified user\'s custom avatar.');
                target = Users.getExact(target) ? Users.getExact(target).name : target;
                var avatars = Config.customavatars;
                if (!avatars[toId(target)]) return this.sendReply('User ' + target + ' does not have a custom avatar.');
                fs.unlinkSync('config/avatars/' + avatars[toId(target)]);
                delete avatars[toId(target)];
                this.sendReply(target + '\'s custom avatar has been successfully removed.');
                if (Users.getExact(target) && Users.getExact(target).connected) {
                        Users.getExact(target).send('Your custom avatar has been removed.');
                        Users.getExact(target).avatar = 1;
                }
        },
       
        shift: 'move',
        move: function (target, room, user, connection, cmd) {
                if (!target || !target.trim()) return this.sendReply('|html|/ca ' + cmd + ' <em>User 1</em>, <em>User 2</em> - Moves User 1\'s custom avatar to User 2.');
                target = this.splitTarget(target);
                var avatars = Config.customavatars;
                var user1 = (this.targetUser ? Users.getExact(this.targetUsername).name : this.targetUsername);
                var user2 = (Users.getExact(target) ? Users.getExact(target).name : target);
                if (!toId(user1) || !toId(user2)) return this.sendReply('|html|/ca ' + cmd + ' <em>User 1</em>, <em>User 2</em> - Moves User 1\'s custom avatar to User 2.');
                var user1Av = avatars[toId(user1)];
                var user2Av = avatars[toId(user2)];
                if (!user1Av) return this.sendReply(user1 + ' does not have a custom avatar.');
 
                if (user2Av) fs.unlinkSync('config/avatars/' + user2Av);
                var newAv = toId(user2) + path.extname(user1Av);
                fs.renameSync('config/avatars/' + user1Av, 'config/avatars/' + newAv);
                delete avatars[toId(user1)];
                avatars[toId(user2)] = newAv;
                if (Users.getExact(user1)) Users.getExact(user1).avatar = 1;
                if (Users.getExact(user2)) {
                        delete Users.getExact(user1).avatar;
                        Users.getExact(user1).avatar = newAv;
                }
 
                return this.sendReply(user1 + '\'s custom avatar has been moved to ' + user2);
        }
};
 
exports.commands = {
        ca: 'customavatar',
        customavatar: cmds,
        shiftavatar: 'moveavatar',
        moveavatar: cmds.move,
        deleteavatar: 'removeavatar',
        removeavatar: cmds['delete'],
        setavatar: cmds.set
}
