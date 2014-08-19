SOCKET_ADDRESS = "ws://192.168.7.2:3333/websocket"

var app = app || {};
app.EventBus = _.extend({}, Backbone.Events);

$(function(){
  //Initialze Application and navigation
  var visualPRU = new app.VisualPRUApplication();
  $(document).foundation();

});

app.PRU = Backbone.Model.extend({
  defaults: {
    id: null,
    state: {
              programCounter: null,
              status: null,
              runMode: null
           },
    program: {
                sourceFiles : [{name:'',content:''}],
                compiledFile : {name: '', content: [{filename:'',lineno: 0, text:''}]},
                errors : [],
                warnings : []
              },
    memory: {
              generalPurpose: [],
              scratchpad: [],
              shared: []
            }
  },
  initialize: function(options){
  }
});

app.VisualPRUApplication = Backbone.View.extend({
  el:'body',
  initialize: function(options){
    //Initialize the Application
    _.extend(this, this.defaults, options);
    this.headerView = new app.HeaderView();
    this.pruView = new app.PRUView();

    //Keep track of the PRUs
    this.prus = {};
    this.activePRU = null;

    //Intiate a socket connection to the backend server
    this.ws = new WebSocket(SOCKET_ADDRESS);
    var that = this;
    this.ws.onopen = function() {
      //Send a socket connection request to the backend
      message = {action:'connect'};
      that.ws.send(JSON.stringify(message));

    };
    this.ws.onmessage = function (evt) {
      var message = JSON.parse(evt.data);//['response'];
      if(message.type == 'pruState'){

        //Update the state of the PRU whose state was changed
        that.prus[message.pruState.id].set(message.pruState);
        app.EventBus.trigger('application:pru:change',{prus: that.prus, activePRU: that.activePRU});

      }else if(message.type == 'connection'){
        if(message.status=='success'){
          _.each(message.availablePRUStates,function(pruState, pruID){
            that.prus[pruID] = new app.PRU(pruState);
          });

          app.EventBus.trigger('application:connection:established');

          //Load the first PRU workspace(sorted by ID) by default
          that.setActivePRU(_.sortBy(_.keys(that.prus))[0]);
        }
      }
    };
    this.ws.onerror = function(error) {
      console.log('WebSocket Error: ' + error);
      app.EventBus.trigger('application:connection:error');
    };
    this.ws.onclose = function() {
      console.log('WebSocket Connection Closed');
      app.EventBus.trigger('application:connection:error');
    };

    //Listen for communication requests from the application
    this.listenTo(app.EventBus, 'header:pru:change', this.setActivePRU);
    this.listenTo(app.EventBus, 'editor:save', this.onEditorSave);
    this.listenTo(app.EventBus, 'editor:compile', this.onEditorCompile);
    this.listenTo(app.EventBus, 'compiler:reset', this.onCompilerReset);
    this.listenTo(app.EventBus, 'compiler:run', this.onCompilerRun);
    this.listenTo(app.EventBus, 'compiler:halt', this.onCompilerHalt);
    this.listenTo(app.EventBus, 'compiler:step', this.onCompilerStep);

    //Disable form submission on enter due to incorrect request being sent
    $(document).on('keypress','form input[type=text]',$.proxy(function(e){
      if ( e.which == 13 ) {
        e.preventDefault();
        //TODO Consider triggering the a.submit button click() on enter to submit the correct request
      }
    },this));

  },

  onEditorSave: function(sourceFiles){
    this.activePRU.get('program').sourceFiles = sourceFiles;
  },

  onEditorCompile: function(sourceFiles){
    this.onEditorSave(sourceFiles);
    //Initiate the server-side compilation
    this.sendPRUAction('compile');
  },

  onCompilerReset: function(){
    this.sendPRUAction('reset');
  },

  onCompilerRun: function(sourceFile){
    this.sendPRUAction('run');
  },

  onCompilerHalt: function(sourceFile){
    this.sendPRUAction('halt');
  },

  onCompilerStep: function(sourceFile){
    this.sendPRUAction('step');
  },

  sendMessage: function(message){
    this.ws.send(JSON.stringify(message));
  },

  sendPRUAction: function(action){
    this.sendMessage({action: action, pruState: this.activePRU.toJSON()});
  },

  setActivePRU: function(pruID){
    //If the requested PRU is valid, then set it to active. Otherwise send 'null' instead of 'undefined' to indicate no active PRU
    this.activePRU = this.prus[pruID];

    if(typeof this.activePRU === 'undefined'){
      this.activePRU = null;
    }

    app.EventBus.trigger('application:pru:change',{prus: this.prus, activePRU: this.activePRU});
  }
});

app.HeaderView = Backbone.View.extend({
  el:'nav',
  initialize: function(options){
    _.extend(this, this.defaults, options);
    this.render();

    this.listenTo(app.EventBus, 'application:pru:change', this.onPRUChange);
  },
  events: {
    'click li.workspace a' : 'onWorkspaceClick',
    'click li.text a' : 'doNothing'
  },
  render: function(links, activeLink){
    this.$el.html(_.template($("#header-view-template").html(),{links: links, activeLink: activeLink}));
    return this;
  },

  onWorkspaceClick: function(e){
    e.preventDefault();
    var pruID = $(e.currentTarget).attr('href');
    app.EventBus.trigger('header:pru:change',pruID);
  },

  doNothing: function(e){
    e.preventDefault();
    return false;
  },

  onPRUChange: function(message){
    //Extract the required information from the message.
    pruIDs = _.sortBy(_.keys(message.prus));

    //There could be the case where there are no active prus
    var activePRUID = null;
    if(message.activePRU != null){
      activePRUID = message.activePRU.get('id');
    }
    this.render(pruIDs, activePRUID);
  }
});

app.PRUView = Backbone.View.extend({
  el:'#pru-view',
  initialize: function(options){
    _.extend(this, this.defaults, options);

    //Render the PRU workspace. Note that we have to render the container view before we can instantiate the subviews
    this.render();
    this.editorView = new app.EditorView({el:this.$el.find('#editor-view')});
    this.compilerView = new app.CompilerView({el:this.$el.find('#compiler-view')});
    this.memoryView = new app.MemoryView({el:this.$el.find('#memory-view')});

    this.listenTo(app.EventBus, 'application:connection:established', this.show);
    this.listenTo(app.EventBus, 'application:connection:failed', this.hide);

    this.hide();
  },
  show: function(){
    this.$el.show();
  },
  hide: function(){
    this.$el.hide();
  },
  render: function(){
    this.$el.html(_.template($("#pru-view-template").html()));
    return this;
  }

});

/*app.StatusView = Backbone.View.extend({
  el:'#status-view',
  initialize: function(options){
    _.extend(this, this.defaults, options);
    //Render the PRU workspace. Note that we have to render the container view before we can instantiate the subviews
    this.render();

    this.listenTo(app.EventBus, 'application:connection:established', this.onConnectionEstablished);
    this.listenTo(app.EventBus, 'application:connection:failed', this.onConnectionFailed);

    this.notifications = [];
  },
  onConnectionEstablished: function(){
    this.$el.show();
  },
  onConnectionFailed: function(){
    this.$el.hide();
  },
  render: function(){
    this.$el.html(_.template($("#status-view-template").html()));
    return this;
  }

});*/

app.EditorView = Backbone.View.extend({
  initialize: function(options){
    _.extend(this, this.defaults, options);

    this.sourceFiles = [];
    this.activeSourceFile = null;

    this.render();

    this.listenTo(app.EventBus, 'application:pru:change', this.onPRUChange);

  },
  events: {
    'click a.new-program' : 'newProgram',
    'click a.compile' : 'compile',
    //'change textarea' : 'prettifyText',
    'keydown textarea' : 'prettifyText',
    'paste textarea' : 'prettifyText',
    'click a.add-file-trigger' : 'addFileTrigger',
    'click a.delete-current-file-trigger' : 'deleteCurrentFileTrigger',
    'click .tab-title a' : 'switchFile',
  },

  onPRUChange: function(message){
    //Store the status of the PRU
    this.pruStatus = message.activePRU.get('state').status;

    //Update the previous PRU's source file prior to rendering the new workspace
    if(this.activeSourceFile!=null){
      this.activeSourceFile.content = this.$el.find('textarea').val();
    }

    //Extract the program-related information from the message if a valid PRU was selected
    if(message.activePRU!=null){
      this.sourceFiles = message.activePRU.get('program').sourceFiles;
      //If source files were loaded to the PRU, then we will store them and select the first one as active
      if(this.sourceFiles.length>0){
        this.activeSourceFile = this.sourceFiles[0];
      }else{
        this.activeSourceFile = null;
      }
    }

    //Render the source files in the editor
    this.render();
  },
  render: function(){
    //Add the content to the DOM
    this.$el.html(_.template($('#editor-view-template').html(), {sourceFiles: this.sourceFiles, activeSourceFile: this.activeSourceFile, pruStatus: this.pruStatus}));

    //Prettify the editor if it rendered to the screen
    //if(this.$el.find('textarea').length != 0){
    if(this.sourceFiles.length>0){
      this.prettifyText();
    }

    //Enable the dynamically generated modal windows
    this.$el.find('#add-file-modal').foundation('reveal');
    return this;
  },
  compile: function(e){
    e.preventDefault();
    //Save the content for the active source file. this.activeSourceFiles references the object in this.sourceFiles, updating one updates the other
    this.activeSourceFile.content = this.$el.find('textarea').val();
    app.EventBus.trigger('editor:compile',this.sourceFiles);
  },
  newProgram: function(e){
    console.log("New Program");
  },
  addFileTrigger: function(e){
    e.preventDefault();
    $('#add-file-modal').foundation('reveal', 'open');
    //Add click handler to dynamic modal
    $('a.add-file').on('click', $.proxy(this.addFile,this));
  },
  //TODO: Check for a valid filename
  addFile: function(e){
    e.preventDefault();

    //Convert Array of name,value objects to a single object
    var tmp = $(e.currentTarget).closest('form').serializeArray();
    var form = _.reduce(tmp,function(object,pair){object[pair.name] = pair.value; return object;},{});

    //Add the file if the name does not exist, and set it as the active source file
    if(_.findWhere(this.sourceFiles, {name:form.name + form.suffix}) === undefined){
      //Save the content of our current file if we are currently editing a file
      if(this.activeSourceFile!=null){
        this.activeSourceFile.content = this.$el.find('textarea').val();
      }

      //Create the new file and add it to the filelist
      this.activeSourceFile = {name: form.name + form.suffix, content:''};
      this.sourceFiles.push(this.activeSourceFile);
    }

    //Remove click handler form dynamic modal
    $('a.add-file').off('click');
    $('#add-file-modal').foundation('reveal', 'close');

    this.render();
  },

  deleteCurrentFileTrigger: function(e){
    e.preventDefault();
    $('#delete-current-file-modal').foundation('reveal', 'open');
    //Add click handler to dynamic modal
    $('a.delete-current-file').on('click', $.proxy(this.deleteCurrentFile,this));
    $('a.cancel-delete-current-file').on('click', $.proxy(this.cancelDeleteCurrentFile,this));
  },

  deleteCurrentFile: function(e){
    e.preventDefault();

    //Find the active source file and delete it from the source list
    var filename =  this.$el.find(".tab-title.active a").data('filename');
    var index;
    for(var i=0;i<this.sourceFiles.length;i++){
      if(this.sourceFiles[i].name == filename){
        this.sourceFiles.splice(i,1);
        break;
      }
    }

    //Set the active source file to the last in the list if there are files in the workspace
    if(this.sourceFiles.length>0){
      this.activeSourceFile = this.sourceFiles[this.sourceFiles.length-1]
    }else{
      this.activeSourceFile = null;
    }

    //Remove click handlers form dynamic modal
    $('a.delete-current-file').off('click');
    $('a.cancel-delete-current-file').off('click');
    $('#delete-current-file-modal').foundation('reveal', 'close');

    this.render();
  },

  cancelDeleteCurrentFile: function(e){
    e.preventDefault();
    //Remove click handlers form dynamic modal
    $('a.delete-current-file').off('click');
    $('a.cancel-delete-current-file').off('click');
    $('#delete-current-file-modal').foundation('reveal', 'close');
  },

  switchFile: function(e){
    e.preventDefault();

    //Store the content of the current file
    this.activeSourceFile.content = this.$el.find('textarea').val();
    var filename = $(e.currentTarget).data('filename');

    //Set the new activeSourceFile
    this.activeSourceFile = _.findWhere(this.sourceFiles,{name: filename});
    this.render();
  },

  prettifyText: function(e){

    var view = this.$el;
    var that = this;
    //The timeout ensures that the text is in the textarea after the events have been fired(specifically the onpaste event)
    setTimeout(function(){
      //Save the updated content to the model
      that.activeSourceFile.content = view.find('textarea').val();

      //Expand the text area size
      var numLines = view.find('textarea').val().replace(/\r?\n$/,'').split(/\r*\n/).length;
      view.find('textarea').attr('rows',(numLines+1).toString());

      //Add line numbers
      var container = view.find('.line-nums')[0];
      var html = '';
      for(var i=0; i<numLines; i++){
        html += '<div class="line-num">'+(i+1)+'</div>';
      }
      $(container).html(html);
    },50);
  }
});

app.CompilerView = Backbone.View.extend({
  initialize: function(options){
    _.extend(this, this.defaults, options);

    this.errors = [];
    this.warnings = [];
    this.compiledFile = {};

    this.listenTo(app.EventBus, 'application:pru:change', this.onPRUChange);

    this.render();

  },
  events: {
    'click a.reset' : 'reset',
    'click a.run' : 'run',
    'click a.halt' : 'halt',
    'click a.step' : 'step'
  },
  onPRUChange: function(message){
    //Extract the required information from the message.
    if(message.activePRU!=null){
      //console.log(message.activePRU);
      this.errors = message.activePRU.get('program').errors;
      this.warnings = message.activePRU.get('program').warnings;
      this.compiledFile = message.activePRU.get('program').compiledFile;
      this.programCounter = message.activePRU.get('state').programCounter;
      this.pruStatus = message.activePRU.get('state').status;
    }
    this.render(); // For now, we only will support the first file
  },
  render: function(){

    //Figure out if the program successfully compiled or not
    var displayData = {status:'empty', lines: [], programCounter: 0, pruStatus: 'halted', hasCompiledFile:false};//_.isEmpty(this.compiledFile.content)
    if(this.errors.length > 0){
      //Errors were found
      displayData.status = 'error';
      displayData.lines = this.errors;
    }else if(!_.isEmpty(this.compiledFile.content)){
      //No errors
      displayData.status = 'success';
      displayData.lines = this.compiledFile.content;
      displayData.programCounter = this.programCounter;
      displayData.pruStatus = this.pruStatus;
      displayData.hasCompiledFile = true;
    }

    //Render to the screen
    this.$el.html(_.template($("#compiler-view-template").html(),displayData));

    return this;
  },
  reset: function(e){
    console.log("reset");
    app.EventBus.trigger("compiler:reset",{action:'reset'});
  },
  run: function(e){
    console.log("run");
    app.EventBus.trigger("compiler:run",{action:'run'});
  },
  halt: function(e){
    console.log("halt");
    app.EventBus.trigger("compiler:halt",{action:'halt'});
  },
  step: function(e){
    console.log("step");
    app.EventBus.trigger("compiler:step",{action:'step'});
  }

});

app.MemoryView = Backbone.View.extend({
  initialize: function(options){
    _.extend(this, this.defaults, options);
    this.listenTo(app.EventBus, 'application:pru:change', this.onPRUChange);
    this.memory = {
              generalPurpose: [],
              scratchpad: [],
              shared: []
            };
    this.render();
  },
  onPRUChange: function(message){
    //Extract the required information from the message.
    if(message.activePRU!=null){
      this.memory = message.activePRU.get('memory');
    }
    this.render(); // For now, we only will support the first file
  },
  events: {
    'click a.compile' : 'compile'
  },
  render: function(){
    this.$el.html(_.template($("#memory-view-template").html(),{memory:this.memory}));
    return this;
  }
});