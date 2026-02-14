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

    #onButton(key, down)
    {
        let handler = this.buttonHandlers[key.index];
        if (!handler)
            return;
        handler.input({ buttonIndex: key.index, press: down });
    }

    setButton(buttonIndex, handler)
    {
        this.buttonHandlers[buttonIndex] = handler;
        this.invalidate(buttonIndex);
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

    invalidate()
    {
        this.manager?.invalidate(this.buttonIndex)
        this.#autoPressImage = null;
    }

    input(ev)
    {
        this.isPressed = ev.press;
        if (ev.press)
            this.press?.(ev);
        else
            this.release?.(ev);

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
                    
                img = clone
                    .resize(width - 6, height - 6, { kernel: 'lanczos3' })
                    .extend({
                        top: 3,
                        bottom: 3,
                        left: 3,
                        right: 3,
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

    onActivate()
    {
        this.manager.setButton(this.buttonIndex, this);
    }

    onDeactivate()
    {
        this.manager.setButton(this.buttonIndex, null);
        this.isPressed = false;
    }

}
