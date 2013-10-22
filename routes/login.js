exports.showLogin = function(req, res){
    res.render('login', { title: 'Login page', user : {username : "", password : ""} } );
}

exports.postLogin = function(req, res){
    var user = req.body.user;
    if(user.password = 123){
	res.cookie('username', user.username, { signed: true });
        res.redirect(301, '/');
    }
}
