# OP-timeline

 A timeline library that allows users to schedule certain functions to run on certain times. Created mainly for generative art purposes, to be used with p5js and OpenProcessing.

# Quick Start

You can create an instance of a timeline with an array of blocks (aka. functions).

```javascript
let myTimeline = new Timeline([{
        func: "drawCircle",
        start: 0,
        end: 100
    },
    {
        func: "drawSquare",
        start: 0,
        end: 100
    },
]);
```

Next, ideally in a timer, you run the `nextFrame` function to run your timeline. Based on the current frame timeline is on, it will run the functions that are defined for that frame.

```javascript
setTimeout(function() {
    myTimeline.nextFrame(); //run a frame every second. 
}, 1000) //Use 1000/60 for 60 frames per second.
```

## Blocks

Blocks contain the information of function name, function start time and end time.

Each **block** object consists of 3 properties. 
* "func": can be the name of a function (string) defined in the global scope (window) or directly the function itself. In string form, you can also provide arguments.
* "start" and "end": the frame numbers that the function should run during. Numbers are inclusive.
* "args": if you pass a function directly, you can also add an array of function arguments

If you would like timestamps instead of frame numbers, you can multiply frames with **estimated fps** and assign above. Note that, the frame rate may be reduced in complicated functions, causing potential inaccuracy if you use do this.

Some examples:

```javascript
function helloWorld(arg1, arg2) {
    //your code here...
}
let myTimeline = new Timeline([{
                func: "helloWorld", //call as string
                start: 0,
                end: 100
            },
            {
                func: "helloWorld('some argument','another argument')", //call it with arguments
                start: 50,
                end: 150
            },
            {
                func: () => {
                    alert("hello world")
                },
                start: 151,
                end: 200
            },
            {
                func: helloWorld, //pass function directly
                args: ['some argument', 'another argument'], //pass arguments directly
                start: 201,
                end: 300
            }
```

## Use with p5js

You can simply add `nextFrame` to your `draw` function.

```javascript
let myTimeline = new Timeline([{
        func: "drawCircle",
        start: 0,
        end: 100
    },
    {
        func: "drawSquare",
        start: 101,
        end: 200
    },
]);

function setup() {
    createCanvas(100, 100);
}

function draw() {
    myTimeline.nextFrame();
}

function drawCircle() {
    circle(10, 10, 100);
}

function drawSquare() {
    square(10, 10, 100);
}
```

## Use with OpenProcessing

[OpenProcessing.org](https://openprocessing.org) provides a powerful and intuitive user interface to use with the timeline library. 

![OpenProcessing Timeline](docs/openprocessing.gif)

On OpenProcessing, you can enable the timeline on code settings. This will automatically add the most recent version of this library to your sketch. Add your timeline code as below: 

```javascript
let myTimeline = new Timeline();

function setup() {
    createCanvas(100, 100);
}

function draw() {
    myTimeline.nextFrame();
}
```

When you run your sketch, the timeline interface will allow you to create and adjust all the blocks within the interface. Any updates will be synced to the timeline library.

On OpenProcessing, all blocks use the String type for function names (with or without arguments). It is not possible to pass functions directly, as parent frame is not aware of the functions created within the sketch iframe.

# Functions
```javascript
myTimeline.play();
myTimeline.stop();
myTimeline.noLoop();
myTimeline.loop();
```
- **play**: proceeds frames every time `nextFrame` is called.
- **stop**: doesn't do anything on `nextFrame`, practically stopping the timeline.
- **noLoop**: prevents timeline to loop when reached at the end.
- **loop**: timeline restarts when it reaches the end. This is enabled by default.  

# Events

OP Timeline supports following events that you can listen to. You can add a listener using `on` function, and trigger them using `trigger` function.
```javascript
myTimeline.on('blockStart', function(){
	//you code here...
})
myTimeline.trigger('frameStart', function(){
	//you code here...
})
```

* **blockStart**: triggered at the start frame of a block, **before** running the block function, 
* **frameStart**: triggered at the start of any frame.
* **frameEnd**: triggered at the end of any frame.
* **start**: triggered at the start of timeline, and every time timeline loops. 
* **beforeLoop**: triggered right before timeline loops at the end.
