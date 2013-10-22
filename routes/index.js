
/*
 * GET home page.
 */
var database = {
    contacts : {
	'alexander' : ['temirlan', 'aibek', 'vadim'],
	'temirlan' : ['alexander', 'aibek', 'vadim'],
	'vadim' : ['alexander', 'aibek', 'temirlan']
    }
};

function isAuthenticated(req){
    return !! req.signedCookies.username;
}

exports.index = function(req, res){
    var contacts = [],
	auth = isAuthenticated(req);
     if(auth){
	 contacts = database.contacts[req.signedCookies.username];
	 console.log(contacts.length);
     }

    res.render('index', { title: 'Express', 
			  user : { 
			      isAuthenticated : auth, 
			      contacts : contacts, 
			      name : req.signedCookies.username 
			  } 
			});
};

exports.logout = function(req, res){
    res.clearCookie('username');
    res.redirect(301, '/');
}

exports.getUserName = function(req, res){
    res.send({username : req.signedCookies.username});
}
