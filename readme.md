# layers-streamdeck

StreamDeck support for [Layers](https://github.com/toptensoftware/layers-core)

## Installation

```
npm install --save @elgato-stream-deck/node
npm install --save toptensoftware/layers-core
npm install --save toptensoftware/layers-streamdeck
```

## Usage

Open StreamDeck device:

```js
import { openStreamDeck, listStreamDecks } from '@elgato-stream-deck/node'

const devices = await listStreamDecks()
console.log(devices);
if (devices.length === 0) throw new Error('No streamdecks connected!')
const sd = await openStreamDeck(devices[0].path)
```

Create StreamDeckManager:

```js
import { StreamDeckManager } from "./streamdeck.js";

let sdm = new StreamDeckManager(sd);
```

Add buttons to layers:

```js
let layer = new Layer();

layer.add(sdm.button({
    buttonIndex: 0,
    image: {
        svgFile: "#heart",
        svgForeColor: "red",
    },
    press(ev)
    {
        console.log("Button Press"),
    }
}));
```

## Button Settings

* `buttonIndex` - the StreamDeck button index
* `image` - a [node-buttonImage](https://github.com/toptensoftware/node-buttonImage) specification
* `input(ev)` - button press and release handler
* `press(ev)` - button press handler where ev = `{ buttonIndex: number, press: boolean, repeat: boolean }`
* `release(ev)` - button release handler
* `longPress(ev)` - long press button handler (on triggering, no release event will be dispatched)
* `repeat` - true to enable auto repeat with default values, a number for a repeat period, or `{ initialDelay: N, period: M }`
* `longPressDelay` - period before `longPress` event is triggered (milliseconds), default = 500
* `autoPressEffect` - set to `false` to disable the automatic press effect (shrink when pressed)


## Example

```js
layer.add(sdm.button({

    // Which button
    buttonIndex: 0,

    // What to display
    image: {
        svgFile: "#heart",
        svgForeColor: "red",
        states: {
            "pressed": {
                svgForeColor: "white",
            }
        }
    },
 
    // Called when button pressed or released (or auto-repeat)
    press(ev)
    {
        console.log(ev);
    },

    // Called when button pressed (or auto-repeat)
    press(ev)
    {
        console.log(ev);

        // Show different image when pressed
        this.image.state = "pressed";
    },

    // Called when button released
    release(ev)
    {
        console.log(ev);

        // Restore original image
        this.image.state = "";
    },

    // Called when button long-press (omit handler to disable long press)
    longPress(ev)
    {
        console.log("LONG PRESS", ev);
    },

    // Long press delay (default = 500)
    longPressDelay: 2000

    // Auto-repeat settings (default = 500, 100)
    repeat: { initialDelay: 1000, period: 50 },

    // Shrink button image when button is pressed (default = true)
    autoPressEffect: true,

}));

```


## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
