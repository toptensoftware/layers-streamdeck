import { ButtonImage } from "@toptensoftware/node-buttonImage";
import sharp from "sharp";

export class StreamDeckManager
{
    constructor(device)
    {
        this.device = device;
        this.device.clearPanel();
        this.buttonHandlers = new Array(this.device.CONTROLS.find((control) => control.type === 'button').length);
        this.device.on('down', (key) => this.#onButton(key, true));
        this.device.on('up', (key) => this.#onButton(key, false));
    }

    #pressedButtons = new Set();
    #suppressButtonUp = new Set();

    #onButton(key, down)
    {
        try
        {
            // Track pressed buttons
            if (down)
                this.#pressedButtons.add(key.index);
            else
                this.#pressedButtons.delete(key.index);

            // Is button up suppressed?
            if (!down && this.#suppressButtonUp.has(key.index))
            {
                this.#suppressButtonUp.delete(key.index);
                return;
            }

            // Find handler
            let handler = this.buttonHandlers[key.index];
            if (!handler)
                return;

            // Call handler
            handler.input({ buttonIndex: key.index, press: down });
        }
        catch (err)
        {
            console.log("Unhandled exception in StreamDeck event handler:", err);
        }

    }

    // Suppress next button up for a button
    // (Used for long press detection and when replacing button that's held)
    suppressButtonUp(buttonIndex)
    {
        this.#suppressButtonUp.add(buttonIndex);
    }

    setButton(buttonIndex, handler)
    {
        // Remember old handler
        let old = this.buttonHandlers[buttonIndex];
        if (handler == old)
            return old;

        // If the button being replaced is currently pressed
        // then ignore the next button up.
        if (this.#pressedButtons.has(buttonIndex))
        {
            this.#suppressButtonUp.add(buttonIndex);
        }

        // Store new handler
        this.buttonHandlers[buttonIndex] = handler;

        // Repaint
        this.invalidate(buttonIndex);

        // Return old handler
        return old;
    }

    invalidate(buttonIndex)
    {
        if (this.#invalidButtons.size == 0)
        {
            process.nextTick(() => this.#update());
        }

        this.#invalidButtons.add(buttonIndex);
    }

    #update()
    {
        let device = this.device;
        let promises = [];
        for (let buttonIndex of this.#invalidButtons)
        {
            // Find button
            let control = device.CONTROLS.find((control) => control.type === 'button' && control.index === buttonIndex);
            if (!control)
                continue;

            let handler = this.buttonHandlers[buttonIndex];
            if (!handler)
            {
                promises.push(device.clearKey(buttonIndex));
            }
            else
            {
                // Set it
                promises.push(updateButton(buttonIndex, control.pixelSize.width, control.pixelSize.height, handler));
            }
        }

        this.#invalidButtons.clear();
        return Promise.all(promises);

        async function updateButton(buttonIndex, width, height, handler)
        {
            // Render image
            let image = await handler.render(width, height);

            await device.fillKeyBuffer(buttonIndex, image)
        }
    }

    #invalidButtons = new Set();

    button(options)
    {
        let button = new StreamDeckButton(options);
        button.manager = this;
        return button;
    }
}

export class StreamDeckButton
{
    constructor(options)
    {
        Object.assign(this, options);

        // Wrap 'image' property in button image renderer
        if (this.image && this.image.render === undefined)
        {
            this.image = new ButtonImage(options.image);
        }

        this.image.onInvalidate = () => this.invalidate();
    }

    manager = null;

    isPressed = false;

    autoPressEffect = true;
    #autoPressImage = null;
    #repeatTimer = null;
    #longPressTimer = null;

    invalidate()
    {
        this.manager?.invalidate(this.buttonIndex)
        this.#autoPressImage = null;
    }

    input(ev)
    {
        this.isPressed = ev.press;
        ev.repeat = false;

        if (ev.press)
        {
            this.press?.(ev);
        }
        else
        {
            this.release?.(ev);
            this.#clearTimers();
        }

        if (ev.press && this.repeat)
        {
            // Work out repeat delay and period
            let period = 100;
            let initialDelay = 500;

            if (typeof(this.repeat) === 'number')
            {
                period = this.repeat;
                initialDelay = this.repeat;
            }
            else if (typeof(this.repeat) === 'object')
            {
                period = this.repeat.period;
                initialDelay = this.repeat.initialDelay ?? this.repeat.period;
            }

            let timerCallback = () => {
                ev.repeat = true;
                this.press?.(ev);
            };

            let initialCallback = () => {
                this.#repeatTimer = setInterval(timerCallback, period);
                timerCallback();
            };

            if (period == initialDelay)
                this.#repeatTimer = setInterval(timerCallback, period);
            else
                this.#repeatTimer = setTimeout(initialCallback, initialDelay);
        }

        if (ev.press && this.longPress !== undefined)
        {
            this.#longPressTimer = setTimeout(() => {
                this.#clearTimers();
                this.manager.suppressButtonUp(this.buttonIndex);
                this.longPress(ev);
            }, this.longPressDelay ?? 500);
        }

        if (this.autoPressEffect)
            this.manager?.invalidate(this.buttonIndex)
    }

    async render(width, height)
    {
        if (this.autoPressEffect && this.isPressed && this.#autoPressImage != null)
            return this.#autoPressImage;

        if (this.image)
        {
            let img = await this.image.render(width, height);
            if (this.autoPressEffect && this.isPressed)
            {
                let clone = sharp(img, {
                    raw: {
                        width: width,
                        height: height,
                        channels: 3
                    }
                });
                    
                const effectSize = parseInt(width *.12);
                img = clone
                    .resize(width - effectSize * 2, height - effectSize * 2, { kernel: 'lanczos3' })
                    .extend({
                        top: effectSize,
                        bottom: effectSize,
                        left: effectSize,
                        right: effectSize,
                        background: { r: 0, g: 0, b: 0, alpha: 1 }
                    })
                    .removeAlpha().raw().toBuffer(); 

                this.#autoPressImage = img;           
            }
            return img;
        }
        else
            return null;
    }

    #clearTimers()
    {
        clearInterval(this.#repeatTimer);
        this.#repeatTimer = null;
        clearInterval(this.#longPressTimer);
        this.#longPressTimer = null;
    }

    #old = null;
    onActivate()
    {
        this.#old = this.manager.setButton(this.buttonIndex, this);
    }

    onDeactivate()
    {
        this.manager.setButton(this.buttonIndex, this.#old);
        this.isPressed = false;
        this.#old = null;
        this.#clearTimers();
    }

}
