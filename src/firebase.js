import * as firebase from 'firebase';

const config = {
    apiKey: "AIzaSyDl_hGGLoI4mqKJ2-m56NdE6tefsJ8BkkA",
    authDomain: "nightlife-c865b.firebaseapp.com",
    databaseURL: "https://nightlife-c865b.firebaseio.com",
    storageBucket: "nightlife-c865b.appspot.com",
};

export const firebaseApp = firebase.initializeApp(config);

export function getLocalUserId() {
    let uid;

    //this key exists if the user is logged in, when logged out is removed
    //the user should be authoraized when seeing the dashboard
    //use it to avoid waiting for firebaseApp.auth().onAuthStateChanged
    for (let key in localStorage) {
        if (key.startsWith('firebase:authUser:')) {
            uid = JSON.parse(localStorage.getItem(key)).uid;
            break;
        }
    }

    return uid;
}
