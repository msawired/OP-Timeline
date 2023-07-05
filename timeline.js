let Timeline = function (blocks = null) {
	//
	/* 
	 * blocks is an array of objects with the following properties:
	 * function: the function that should be called
	 * start: the frame at which the block starts	
	*/
	this.hasBlocks = blocks ? true : false; //if there are no blocks, follow the timeline of the sketch
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


	//add end frame to each block if not provided already. End frame is equal to next frames start frame
	this.blocks.forEach((b, i) => {
		if(typeof b.func == 'string') {
			//if function is string, extract the function and arguments from the string
			b.args = b.args ?? this._extractArgs(b.func) ?? [];
			b.func = this._extractFunctionName(b.func) ?? null;
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
		this.hasBlocks && $OP.callParentFunction("initTimeline", this.blocks);
		$OP.callParentFunction("timelineReady", true);
		$OP.callParentFunction("timelinePlaying", this.playing);
	}
	//setup listener for messages from OpenProcessing
	window.addEventListener("message", this._receiveMessage.bind(this), '*');

}

Timeline.prototype.nextFrame = function () {
	if (this.playing && this.end > 0) {
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
			b.func(...b.args);
			b.end == this.frame && this.trigger('blockEnd');
		});

		//outro

		this.trigger('frameEnd');

		if (this.frame >= this.end) {
			if (this.loop) {
				this.frame = 0;
				this.trigger('beforeLoop');
			}
			else {
				this.stop();
			}
		}
		this.frame++;

	}
}

Timeline.prototype.stop = function () {
	this.playing = false;
	window.$OP && $OP.callParentFunction("timelinePlaying", this.playing);
}

Timeline.prototype.play = function () {
	this.playing = true;
	window.$OP && $OP.callParentFunction("timelinePlaying", this.playing);
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
		this.nextFrame();
	}
	this.loop = wasLooping;
	this.playing = wasPlaying;
}

/* INTERNAL FUNCTIONS BELOW */

Timeline.prototype._receiveMessage = function (event) {
	let messageType = event.data.messageType;
	if (event.data) {
		let data = typeof event.data.message !== 'undefined' ? event.data.message : null;
		// console.log('message received', messageType, data);
		switch (messageType) {
			case 'jumpToFrame':
				// console.log('jumping to frame', data);
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
		}
	}
}

//syncs the given blocks
Timeline.prototype.syncTimeline = function (blocks) {
	if (this.hasBlocks) {
		return; //do not sync if there are blocks defined initially. Code overrides DB.
	}
	let wasPlaying = this.playing;
	this.stop();
	this.blocks = JSON.parse(blocks);

	//get function and arguments from title
	this.blocks.forEach(b => {
		b.func = ()=>{};
		b.args = [];
		if (b.title in window) { //simple form: function name is the same as title
			b.func = window[b.title];
		} else if (b.args = this._extractArgs(b.title)) { //complex form: title has arguments
			let fName = this._extractFunctionName(b.title);
			if (fName in window) {
				b.func = window[fName];
			} else { //function not found
				// sync back that function is not found
				$OP.callParentFunction("timelineFunctionMissing", b.title);
				// console.warn(`Function "${b.title}" in timeline is not found in code.`);
			}
		} else {
			b.args = [];
			$OP.callParentFunction("timelineFunctionMissing", b.title);
			// console.warn(`Function "${b.title}" in timeline is not found in code.`);
		}
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
Timeline.prototype._extractArgs = function (title) {
	//extract arguments from function title
	let args = title.match(/\((.*?)\)/);
	if (args) {
		args = args[1].split(',').map(a => a.trim());
	}
	return args;
}
Timeline.prototype._extractFunctionName = function (title) {
	//extract function name from function title
	let args = title.match(/\((.*?)\)/);
	return args ? title.replace(args[0], '') : title;
}


