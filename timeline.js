let Timeline = function (blocks = null) {
	//
	/* 
	 * blocks is an array of objects with the following properties:
	 * function: the function that should be called
	 * start: the frame at which the block starts	
	*/
	this.hasBlocksOnInit = blocks ? true : false; //if there are no blocks, follow the timeline of the sketch
	this.blocks = blocks ?? []; //holds the blocks. 
	/**
	 * Each block is {func: string or function, start: frame, end: frame, [args: array]}
	 * func: the function that should be called. It can be a string or a function. If it is a string, it should be the name of a function in the sketch. If provided with arguments, they will be extracted to the args property automatically.
	 *  */
	this.frame = 0; //holds the current frame
	this.playing = true;
	this.loop = true;
	this.end = 0;
	this.prevBlocks = [];
	this.events = {
		'blockStart': null,
		'frameStart': null,
		'frameEnd': null,
		'start': null,
		'beforeLoop': null
	}
	this.frameRate = 60;
	this.interval = null;
	this.preventP5Loop = true;

	//if no blocks defined, add draw as default block
	if (!this.hasBlocksOnInit) {
		this.blocks.push({
			func: 'draw',
			start: 0,
			end: 100
		});
	}




	//add end frame to each block if not provided already. End frame is equal to next frames start frame
	this.blocks.forEach((b, i) => {
		if (typeof b.func == 'string') {
			//if function is string, extract the function and arguments from the string
			b.title = b.func;
			this._extractFunction(b);
		} else { //function
			b.title = b.func.name ?? 'Function ' + i;
			b.args = b.args ?? [];
		}


		if (typeof b.end == 'undefined') {
			if (i < this.blocks.length - 1) {
				b.end = this.blocks[i + 1].start - 1;
			} else {
				b.end = this.blocks[i].start + 100; //should there be a max frame?
			}
		}

	});

	//set end of timeline to the max end frame of all blocks
	this._calculateEnd();


	//reverse blocks so that the last block is the first to be called
	this.blocks.reverse();

	//communicate with OpenProcessing
	if (window.$OP) {
		$OP.callParentFunction("initTimeline", this.blocks);
		$OP.callParentFunction("timelineReady", true);
		$OP.callParentFunction("timelinePlaying", this.playing);
	}
	//setup listener for messages from OpenProcessing
	window.addEventListener("message", this._receiveMessage.bind(this), '*');
	this.interval = setInterval(this.drawNextFrame.bind(this), 1000 / this.frameRate);

	//pause p5js draw loop
	if (this.preventP5Loop) {
		window.onload = function(){
			noLoop && noLoop();
		}
	}

}

Timeline.prototype.drawNextFrame = function () {

	if (this.playing && this.end > 0) {
		//pause p5js draw loop
		if (window.noLoop && this.preventP5Loop) {
			noLoop();
		}
		//intro
		this.frame == 0 && this.trigger('start');

		if (window.$OP) {
			$OP.callParentFunction("setTimelineFrame", this.frame);
		}
		this.trigger('frameStart');

		//find the functions that is in this frame and call them
		let activeBlocks = this.blocks.filter(b => b.start <= this.frame && b.end >= this.frame);
		activeBlocks.length && activeBlocks.reverse();

		//check if there is any new blocks. if so, run blockStart once
		// if (this.events['blockStart']) {
		// 	this.blocks.find(b => b.start == this.frame) && this.trigger('blockStart');
		// }

		//chorus: run functions
		activeBlocks.forEach(b => {
			b.start == this.frame && this.trigger('blockStart');
			if(typeof b.func == 'function'){
				b.func(...b.args);
			}
			b.end == this.frame && this.trigger('blockEnd');
		});

		//outro

		this.trigger('frameEnd');

		if (this.frame >= this.end) {
			if (this.loop) {
				this._reset();
				this.trigger('beforeLoop');
			}
			else {
				this.stop();
			}
		}
		this.frame++;

	}
}

Timeline.prototype.setFrameRate = function (frameRate) {
	this.frameRate = frameRate;
	clearInterval(this.interval);
	this.interval = setInterval(this.drawNextFrame.bind(this), 1000 / this.frameRate);
}


Timeline.prototype.play = function () {
	this.playing = true;
	window.$OP && $OP.callParentFunction("timelinePlaying", this.playing);
}
Timeline.prototype.pause = function () {
	this.playing = false;
	window.$OP && $OP.callParentFunction("timelinePlaying", this.playing);
}
Timeline.prototype.stop = function () {
	this._reset();
	this.playing = false;
	window.$OP && $OP.callParentFunction("timelinePlaying", this.playing);
}
Timeline.prototype.restart = function () {
	this._reset();
	this.play();
}
Timeline.prototype.noLoop = function () {
	this.loop = false;
}
Timeline.prototype.loop = function () {
	this.loop = true;
}
Timeline.prototype.on = function (eventName, func) {
	this.events[eventName] = func;
}
Timeline.prototype.trigger = function (eventName) {
	this.events[eventName] && this.events[eventName]();
}
Timeline.prototype.jumpToFrame = function (frame) {
	frame = +frame;
	if (frame > this.end)
		return;

	//if target is before the current frame, restart the sketch from the beginning
	if (this.frame > frame) {
		this.frame = 0;
	}
	let wasPlaying = this.playing;
	let wasLooping = this.loop;
	this.playing = true;
	this.loop = false; //prevent infinite loops
	while (this.frame <= frame) {
		this.drawNextFrame();
	}
	this.loop = wasLooping;
	this.playing = wasPlaying;
}

/* INTERNAL FUNCTIONS BELOW */
Timeline.prototype._reset = function () {
	this.frame = 0;
	if (window.$OP) {
		$OP.callParentFunction("setTimelineFrame", this.frame);
	}
}

Timeline.prototype._receiveMessage = function (event) {
	let messageType = event.data.messageType;
	if (event.data) {
		let data = typeof event.data.message !== 'undefined' ? event.data.message : null;
		switch (messageType) {
			case 'jumpToFrame':
				this.jumpToFrame(data);
				break;
			case 'syncTimeline':
				this.syncTimeline(data);
				break;
			case 'playTimeline':
				if (this.frame >= this.end) {
					this.frame = 0;
				}
				this.play();
				break;
			case 'stopTimeline':
				this.stop();
				break;
			case 'pauseTimeline':
				this.pause();
				break;
		}
	}
}

//syncs the given blocks to self blocks
Timeline.prototype.syncTimeline = function (blocks) {
	if (this.hasBlocksOnInit) {
		return; //do not sync if there are blocks defined initially. Code overrides DB.
	}
	let wasPlaying = this.playing;
	this.stop();
	this.blocks = JSON.parse(blocks);

	//get function and arguments from title
	this.blocks.forEach(b => {
		//always comes as string
		this._extractFunction(b);
	});

	this._calculateEnd();
	this._checkFrame();
	if (wasPlaying) {
		this.play();
	}
}
// makes sure current frame is within the timeline
Timeline.prototype._checkFrame = function () {
	if (this.frame < 0) {
		this.frame = 0;
	}
	if (this.frame > this.end) {
		this.frame = this.end;
	}
}
Timeline.prototype._calculateEnd = function () {
	//set end of timeline to the max end frame of all blocks
	this.end = this.blocks.reduce((a, b) => {
		return Math.max(a, b.end);
	}, 0);
}
Timeline.prototype._extractFunction = function (b) {
	//check if function is without arguments
	if(window[b.title]){
		b.func = window[b.title];
		b.args = [];
		return true;
	}

	// Extract the function name and arguments from the string
	const regex = /([^\s]+)\((.*)\)/;
	const match = b.title.match(regex);
	if (!match) {
		b.func=()=>{};
		b.args = [];
		$OP.callParentFunction("timelineFunctionMissing", b.title);
		return false;
		// throw new Error('Invalid function definition in timeline block');
	}


	const functionName = match.length >= 1 ? match[1] : null;
	const argsString = match.length >= 2 ? match[2] : null;
	b.func = window[functionName];
	b.args = argsString ? eval(`[${argsString}]`) : [];

	if (!b.func) {
		//function not found
		// sync back that function is not found
		$OP.callParentFunction("timelineFunctionMissing", b.title);
	}
	return true;
}


