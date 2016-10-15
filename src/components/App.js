import React, { Component } from 'react';
import injectTapEventPlugin from 'react-tap-event-plugin';
import 'whatwg-fetch';
import { firebaseApp } from '../firebase';

import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import AppBar from 'material-ui/AppBar';
import FlatButton from 'material-ui/FlatButton';
import TextField from 'material-ui/TextField';
import RaisedButton from 'material-ui/RaisedButton';
import Divider from 'material-ui/Divider';
import FloatingActionButton from 'material-ui/FloatingActionButton';
import ContentAdd from 'material-ui/svg-icons/content/add';
import ContentRemove from 'material-ui/svg-icons/content/remove';
import Dialog from 'material-ui/Dialog';

// Needed for onTouchTap
// http://stackoverflow.com/a/34015469/988941
injectTapEventPlugin();


//get your own at https://developer.foursquare.com
const cId = 'XLK3QO44M52SWR0XTCOYKAPE0O2XOCD2CVAMBBWVLKB0RT0E';
const cSecret = 'FFIX1KXZ0MV1D1WEPN4CXSGJA211CT5F5UHFC2WN3FQI4U5C';

class App extends Component {

  constructor(props) {
    super(props);

    this.state = {
      searchValue: '',
      loggedIn: false,
      venues: [], // { name: '', info: '', id: '', count: 0, userGoing: false} on search load have to update this and when user adds/ remove from venue
      errorMessage: '',

      dialogOpen: false,
      email: '',
      password: '',
      dialogIsLogin: true

    };
  }

  componentWillMount() {
    firebaseApp.auth().onAuthStateChanged(user => {
      this.setState({
        loggedIn: (null !== user) //user is null when not loggedin 
      })
    });
  }

  //not necessary to bind this
  handleSearchChange = (event) => {
    this.setState({
      searchValue: event.target.value,
    });
  };

  handleSearch = () => {
    if (this.state.searchValue.trim() === '') {
      this.setState({ venues: [], errorMessage: '' });
      return;
    }

    fetch(`https://api.foursquare.com/v2/venues/search?near=${encodeURI(this.state.searchValue)}&client_id=${cId}&client_secret=${cSecret}&v=20140806%20&m=foursquare&query=bar`)
      .then((response) => {

        if (!response.ok) {
          throw Error(response.statusText);
        }

        return response.json()
      }).then((json) => {

        const venues = json.response.venues.map(venue => {
          const name = venue.name;
          const id = venue.id;

          let info = venue.categories.reduce((a, cat) => {
            return `${a} ${cat.name}`;
          }, '');
          info += ', ' + venue.location.formattedAddress[0];


          let userGoing = false;
          let count = 0;

          return { name, id, info, count, userGoing };
        });

        if (venues.length === 0) {
          this.setState({ venues: [], errorMessage: 'No results :(' });
        } else {

          this.setState({ venues, errorMessage: '' });

          let updatedVenues = [];
          const uid = firebaseApp.auth().currentUser ? firebaseApp.auth().currentUser.uid : null;

          this.state.venues.forEach(venue => {

            let upVenue = venue;

            if (uid === null) { //dont check for userGoing when not loggedin

              
              firebaseApp.database().ref(`/venues/${upVenue.id}`).once('value').then((snapshot) => {

                if (snapshot.val()) {
                  upVenue = Object.assign(upVenue, { count: snapshot.val() });
                }

                updatedVenues.push(upVenue);
                this.setState({ updatedVenues, errorMessage: '' });
              });

            } else {
            //checkk on user-venue if this is exists
            //then get the venue count .. it doenst have to be in callbacks, i could use promise.all but KISS
            firebaseApp.database().ref(`/user-venues/${uid}/${venue.id}`).once('value').then((userSnapshot) => {

              if (userSnapshot.val()) {
                upVenue = Object.assign(upVenue, {userGoing: userSnapshot.val() }); // is always has to be true ...
              }

              firebaseApp.database().ref(`/venues/${upVenue.id}`).once('value').then((snapshot) => {

                if (snapshot.val()) {
                  upVenue = Object.assign(upVenue, { count: snapshot.val() });
                }

                updatedVenues.push(upVenue);
                this.setState({ updatedVenues, errorMessage: '' });
              });

            });
            }

          });

          

        }

      }).catch((ex) => {
        console.log('parsing failed', ex)
        this.setState({ venues: [], errorMessage: ex.message });
      })
  }

  handleOpen = (isLogin, e) => {
    this.setState({ dialogOpen: true, dialogIsLogin: isLogin, email: '', password: '' });
  }

  handleAction = () => {
    const email = this.state.email.trim();
    const password = this.state.password.trim();

    if (this.state.dialogIsLogin) {

      firebaseApp.auth().signInWithEmailAndPassword(email, password).then((user) => {
        console.log('login done');
      });

    } else {
      firebaseApp.auth().createUserWithEmailAndPassword(email, password).then((user) => {
        console.log('signup done');
      });
    }
    this.setState({ dialogOpen: false });
  }

  handleClose = () => {
    this.setState({ dialogOpen: false });
  }

  handleEmailChange = (e) => {
    this.setState({ email: e.target.value });
  }

  handlePasswordChange = (e) => {
    this.setState({ password: e.target.value });
  }

  handleLogout = () => {
    firebaseApp.auth().signOut().then(() => {
      console.log("sign out succesful");
    });
  }


  updateVenue = (id, going, e) => {

    const uid = firebaseApp.auth().currentUser.uid;

    let updates = {};

    if (!going) { //if the user is currently not going, add
      //need to know if it exists, if it does get the value and += 1, else create it with 1
      firebaseApp.database().ref(`/venues/${id}`).once('value').then((snapshot) => {

        if (snapshot) {
          const count = snapshot.val();
          updates[`/venues/${id}`] = count + 1;

        } else {
          updates[`/venues/${id}`] = 1;
        }

        updates[`/user-venues/${uid}/${id}`] = true;
        firebaseApp.database().ref().update(updates);

        //update current state.venues
        let venues = this.state.venues;
        const venueIndex = venues.findIndex(x => x.id === id)
        venues[venueIndex] = Object.assign(venues[venueIndex], { userGoing: true, count: venues[venueIndex].count + 1 });

        this.setState({ venues });

      });
    } else {
      //set null to /user-venues
      //decrease count on venue .. cant reach < 0
      firebaseApp.database().ref(`/venues/${id}`).once('value').then((snapshot) => {
        const count = snapshot.val();

        updates[`/venues/${id}`] = count - 1;
        updates[`/user-venues/${uid}/${id}`] = null;
        firebaseApp.database().ref().update(updates);

        //update current state.venues
        let venues = this.state.venues;
        const venueIndex = venues.findIndex(x => x.id === id)
        venues[venueIndex] = Object.assign(venues[venueIndex], { userGoing: false, count: venues[venueIndex].count - 1 });

        this.setState({ venues });

      });

    }
  }

  render() {

    const appBarActions = this.state.loggedIn ?
      <FlatButton label="Logout" onTouchTap={this.handleLogout} />
      :
      <div>
        <FlatButton label="Login" onTouchTap={this.handleOpen.bind(this, true)} />
        <FlatButton label="Signup" onTouchTap={this.handleOpen.bind(this, false)} />
      </div>;

    const actions = [
      <FlatButton
        label={this.state.dialogIsLogin ? 'Login' : 'Signup'}
        primary={true}
        onTouchTap={this.handleAction}
        />,
    ];

    let venuesUI;

    if (this.state.errorMessage !== '') {
      venuesUI = <p className="text-xs-center">{this.state.errorMessage}</p>;
    } else {

      venuesUI = this.state.venues.map(venue => {
        return (
          <div className="row v-center" key={venue.id}>


            <div className="col-sm-10">
              <br />
              <h3>{venue.name}</h3>
              <p>{venue.info}</p>
              <Divider />
            </div>

            <div className="col-sm-1 text-xs-center ">
              <br />
              <p>{venue.count} going</p>
            </div>

            <div className="col-sm-1 text-xs-center">

              <FloatingActionButton
                mini={true}
                disabled={!this.state.loggedIn}
                onTouchTap={this.updateVenue.bind(this, venue.id, venue.userGoing)}
                >
                {venue.userGoing ? <ContentRemove /> : <ContentAdd />}
              </FloatingActionButton>
            </div>

          </div>
        );

      });
    }

    return (

      <MuiThemeProvider>
        <div className="container-fluid">

          <Dialog
            title={this.state.dialogIsLogin ? 'Login' : 'Signup'}
            actions={actions}
            modal={false}
            open={this.state.dialogOpen}
            onRequestClose={this.handleClose}
            >

            <TextField hintText="Email" value={this.state.email} onChange={this.handleEmailChange} />
            <TextField hintText="Password" type="password" value={this.state.password} onChange={this.handlePasswordChange} />

          </Dialog>


          <div className="row"> {/* no col-sm-12 to avoid padding */}
            <AppBar
              title="Nightlife Bar Coordinator"
              showMenuIconButton={false}
              iconElementRight={appBarActions}
              />
          </div>

          <div className="row">
            <div className="col-sm-12 text-xs-center">
              <br />
              <TextField
                id="searchField"
                value={this.state.searchValue}
                onChange={this.handleSearchChange}
                hintText="Where are you?"
                onKeyPress={(e) => (e.key === 'Enter' ? this.handleSearch() : null)}
                />
              &nbsp;&nbsp;
              <RaisedButton
                label="Search"
                primary={true}
                onTouchTap={this.handleSearch}
                />
              <br /><br />
            </div>
          </div>

          {venuesUI}

          <br /><br />
          <p className="text-xs-center">This app uses the Foursquare API.</p>
        </div>
      </MuiThemeProvider>
    );
  }
}

export default App;
