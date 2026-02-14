import { Layer } from "@toptensoftware/layers.core";

import { openStreamDeck, listStreamDecks } from '@elgato-stream-deck/node'
import { StreamDeckManager } from "./streamdeck.js";

// List the connected streamdecks
const devices = await listStreamDecks()
console.log(devices);
if (devices.length === 0) throw new Error('No streamdecks connected!')
const sd = await openStreamDeck(devices[0].path)

let sdm = new StreamDeckManager(sd);


let layer = new Layer();

layer.add(sdm.button({

    buttonIndex: 14,

    image: {
        svgFile: "#apple-tv",
        svgForeColor: "red",
        states: {
            "pressed": {
                svgForeColor: "white",
            }
        }
    },

    //autoPressEffect: true,

    press(ev)
    {
        console.log(ev);
        this.image.state = "pressed";
    },

    release(ev)
    {
        console.log(ev);
        this.image.state = "";
    }

}));


layer.activate();
//layer.deactivate();

