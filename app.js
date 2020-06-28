/* jshint globalstrict:true, trailing:false, unused:true, node:true */

'use strict';

const express = require('express');
const passport = require('passport');
const OAuth2Strategy = require('passport-oauth2');
const request = require('request');
const url = require('url');

const gitterHost = process.env.HOST || 'https://gitter.im';
const port = process.env.PORT || 7000;

// validating that the user argument is a valid URL otherwise the passport authenticator will fail silently
const gitterHostUrl = url.parse(gitterHost);
if (['https:', 'http:'].indexOf(gitterHostUrl.protocol) < 0) {
  throw new Error('the gitter host URL needs to have http(s) protocol');
}

// Client OAuth configuration
const clientId = process.env.GITTER_KEY ? process.env.GITTER_KEY.trim() : undefined;
const clientSecret = process.env.GITTER_SECRET ? process.env.GITTER_SECRET.trim() : undefined;

// Gitter API client helper
const gitter = {
  fetch(path, token, cb) {
    const options = {
      url: gitterHost + path,
      headers: {
        Authorization: `Bearer ${token}`,
      },
    };

    // eslint-disable-next-line consistent-return
    request(options, (err, res, body) => {
      if (err) return cb(err);

      if (res.statusCode === 200) {
        cb(null, JSON.parse(body));
      } else {
        cb(`err${res.statusCode}`);
      }
    });
  },

  fetchCurrentUser(token, cb) {
    this.fetch('/api/v1/user/', token, (err, user) => {
      cb(err, user[0]);
    });
  },

  fetchRooms(user, token, cb) {
    this.fetch(`/api/v1/user/${user.id}/rooms`, token, (err, rooms) => {
      cb(err, rooms);
    });
  },
};

const app = express();

// Middlewares
app.set('view engine', 'jade');
app.set('views', `${__dirname}/views`);
app.use(express.json());
app.use(express.urlencoded());
app.use(express.static(`${__dirname}/public`));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(express.cookieParser());
app.use(express.session({ secret: 'keyboard cat' }));
app.use(passport.initialize());
app.use(passport.session());
app.use(app.router);

// Passport Configuration

passport.use(
  new OAuth2Strategy(
    {
      authorizationURL: `${gitterHost}/login/oauth/authorize`,
      tokenURL: `${gitterHost}/login/oauth/token`,
      clientID: clientId,
      clientSecret,
      callbackURL: '/login/callback',
      passReqToCallback: true,
    },
    (req, accessToken, refreshToken, profile, done) => {
      // TODO this is tmp disable to fix all eslint errors
      // eslint-disable-next-line
      req.session.token = accessToken;
      gitter.fetchCurrentUser(accessToken, (err, user) => (err ? done(err) : done(null, user)));
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, JSON.stringify(user));
});

passport.deserializeUser((user, done) => {
  done(null, JSON.parse(user));
});

app.get('/login', passport.authenticate('oauth2'));

app.get(
  '/login/callback',
  passport.authenticate('oauth2', {
    successRedirect: '/home',
    failureRedirect: '/',
  }),
);

app.get('/logout', (req, res) => {
  req.session.destroy();
  res.redirect('/');
});

app.get('/', (req, res) => {
  res.render('landing');
});
// TODO this is tmp disable to fix all eslint errors
// eslint-disable-next-line
app.get('/home', (req, res) => {
  if (!req.user) return res.redirect('/');

  // Fetch user rooms using the Gitter API
  // TODO this is tmp disable to fix all eslint errors
  // eslint-disable-next-line
  gitter.fetchRooms(req.user, req.session.token, (err, rooms) => {
    if (err) return res.send(500);

    res.render('home', {
      user: req.user,
      token: req.session.token,
      clientId,
      rooms,
    });
  });
});

app.listen(port);
console.log(`Demo app running at http://localhost:${port}`);
