'use strict';

// TODO: Hide App and util into IIFE
// TODO: It should expand parent todo and display its completed children when clicked 'Completed'
// TODO: It should display completed parent with uncompleted child when clicked 'Active'

// MAYBE: Add expandAll button left to the newTodoInput
// MAYBE: Handle correct view when completed parent with some uncompleted child
// MAYBE: Don't toggle children when toggling parent

var ENTER_KEY = 13;
var ESCAPE_KEY = 27;

var util = {
  uuid: function() {
    /*jshint bitwise:false */
    var i, random;
    var uuid = '';

    for (i = 0; i < 32; i++) {
      random = Math.random() * 16 | 0;
      if (i === 8 || i === 12 || i === 16 || i === 20) {
        uuid += '-';
      }
      uuid += (i === 12 ? 4 : (i === 16 ? (random & 3 | 8) : random)).toString(16);
    }

    return uuid;
  },
  pluralize: function(count, word) {
    return count === 1 ? word : word + 's';
  },
  store: function(namespace, data) {
    if (arguments.length > 1) {
      return localStorage.setItem(namespace, JSON.stringify(data));
    } else {
      var store = localStorage.getItem(namespace);
      return (store && JSON.parse(store)) ||
      {
        id: 'root',
        title: 'nested todos',
        children: [],
        completed: false,
        expanded: false,
        parentId: null
      };
    }
  },
  setHash: function(hash) {
    location.hash = hash;
  }
};

var App = {
  init: function() {
    this.todoTemplate = function(todo) {
      var li = document.createElement('li');
      if (todo.completed) {
        li.classList.add('completed');
      }
      li.setAttribute('data-id', todo.id);

      var view = document.createElement('div');
      view.classList.add('view');
      if (todo.children.length > 0) {
        var expandInput = document.createElement('input');
        expandInput.classList.add('expand');
        expandInput.type = 'checkbox';
        expandInput.checked = todo.expanded;
        view.append(expandInput);
      }

      var toggleInput = document.createElement('input');
      toggleInput.classList.add('toggle');
      toggleInput.type = 'checkbox';
      toggleInput.checked = todo.completed;
      view.append(toggleInput);

      var label = document.createElement('label');
      var link = document.createElement('a');
      link.href = '#/' + todo.id + '/all';
      link.textContent = todo.title;
      label.append(link);
      view.append(label);

      var btn = document.createElement('button');
      btn.classList.add('destroy');
      view.append(btn);
      li.append(view);

      var editInput = document.createElement('input');
      editInput.classList.add('edit');
      editInput.value = todo.title;
      li.append(editInput);

      var ul = document.createElement('ul');
      ul.classList.add('children');
      if (todo.expanded) {
        ul.classList.add('expanded');
      }
      li.append(ul);

      return li;
    };

    this.crumbTemplate = function(parts) {
      return parts.map(function(part) {
        return `
          <li class="crumb">
            <a href="${part.href}">
              <span class="text">${part.text}</span>
            </a>
          </li>`;
      }).join('');
    };

    this.footerTemplate = function(props) {
      return `
        <section>
          <span id="todo-count">
            <strong>${props.activeTodoCount}</strong>
            ${props.activeTodoWord} left
          </span>
          <ul id="filters">
            <li>
              <a class="${props.filter === 'all' ? 'selected' : ''}" href="#/${props.parentId}/all">
                All
              </a>
            </li>
            <li>
              <a class="${props.filter === 'active' ? 'selected' : ''}" href="#/${props.parentId}/active">
                Active
              </a>
            </li>
            <li>
              <a class="${props.filter === 'completed' ? 'selected' : ''}" href="#/${props.parentId}/completed">
                Completed
              </a>
            </li>
          </ul>
          ${props.completedTodos ?
          '<button id="clear-completed">Clear completed</button>' :
          ''}
        </section>
      `;
    };

    this.nestedTodos = util.store('nested-todos');
    this.bindEvents();

    // Roater approach
    // new Router({
    //   '/:id/:filter': function(id, filter) {
    //     this.filter = filter;
    //     this.focusedTodoId = id;
    //     this.render();
    //   }.bind(this)
    // }).init('/root/all');

    this.filter = 'all';
    this.focusedTodoId = 'root';
    util.setHash('#/root/all');
    this.render();
  },
  bindEvents: function() {
    var newTodoInput = document.querySelector('#new-todo');
    var toggleAllCheckbox = document.querySelector('#toggle-all');
    var footer = document.querySelector('#footer');
    var todoListUl = document.querySelector('#todo-list');

    window.addEventListener('hashchange', function() {
      var hash = location.hash;
      var id = hash.match(/(?<=#\/).+(?=\/)/)[0];
      var filter = hash.match(/\w+$/)[0];
      this.focusedTodoId = id;
      this.filter = filter;
      this.render();
    }.bind(this));

    newTodoInput.addEventListener('keyup', this.create.bind(this));
    toggleAllCheckbox.addEventListener('change', this.toggleAll.bind(this));
    footer.addEventListener('click', function(e) {
      if (e.target.id === 'clear-completed') {
        this.destroyCompleted(e);
      }
    }.bind(this));
    todoListUl.addEventListener('dblclick', function(e) {
      if (e.target.tagName === 'LABEL') {
        this.edit(e);
      }
    }.bind(this));
    todoListUl.addEventListener('keyup', function(e) {
      if (e.target.className.includes('edit')) {
        this.editKeyup(e);
      }
    }.bind(this));
    todoListUl.addEventListener('focusout', function(e) {
      if (e.target.className === 'edit') {
        this.update(e);
      }
    }.bind(this));
    todoListUl.addEventListener('click', function(e) {
      if (e.target.className === 'destroy') {
        this.destroy(e);
      }
    }.bind(this));
    todoListUl.addEventListener('change', function(e) {
      if (e.target.className === 'toggle') {
        this.toggle(e);
      }
    }.bind(this));
    todoListUl.addEventListener('change', function(e) {
      if (e.target.className === 'expand') {
        this.expand(e);
      }
    }.bind(this));
    // todoListUl.addEventListener('click', function(e) {
    //   if (e.target.tagName === 'A') {
    //     var id = e.target.closest('li').dataset.id;
    //     this.focusedTodoId = id;
    //     this.render();
    //   }
    // }.bind(this));
  },
  render: function() {
    var focusedTodo = this.getTodo(this.focusedTodoId);
    var children = this.getFilteredTodos(focusedTodo.children);

    // Render header and crumbs navigation
    this.renderCrumbs();
    var headline = document.querySelector('h1 span');
    headline.textContent = focusedTodo.title;

    // Render todos
    this.renderTodos(focusedTodo, children);

    // Hide todos' section element if no todos
    var main = document.querySelector('#main');
    main.style.display = children.length > 0 ? 'block' : 'none';

    var toggleAllCheckbox = document.querySelector('#toggle-all');
    toggleAllCheckbox.checked = this.getActiveTodos(children).length === 0;

    // Set focus to the new-todo input
    var newTodoInput = document.querySelector('#new-todo');
    newTodoInput.focus();

    // Renders footer
    this.renderFooter();

    // Store todos in the localStorage
    util.store('nested-todos', this.nestedTodos);
  },
  renderTodos: function(parent, children) {
    var parentId = parent.id;
    var selector = '#todo-list';

    if (parentId !== this.focusedTodoId) {
      selector = `[data-id='${parentId}'] .children`;
    }

    var ul = document.querySelector(selector);
    ul.innerHTML = '';

    children.forEach(function(todo) {
      var todoChildren = this.getFilteredTodos(todo.children);
      var todoHtml = this.todoTemplate(todo);
      ul.append(todoHtml);

      if (todo.expanded) {
        this.renderTodos(todo, todoChildren);
      }
    }, this);
  },
  renderCrumbs: function() {
    var focusedTodo = this.getTodo(this.focusedTodoId);
    var parent = this.getTodo(focusedTodo.parentId);
    var parts = [];

    while (parent) {
      var text = parent.title;
      var href = '#/' + parent.id + '/all';

      if (parent.id === 'root') {
        text = 'Home';
      }

      parts.unshift({ href: href, text: text });
      parent = this.getTodo(parent.parentId);
    }

    // Shortens rendered crumbs if more than 4 items
    if (parts.length > 4) {
      var placeholder = {
        href: parts[parts.length - 2].href,
        text: '...'
      };
      parts.splice(2, parts.length - 3, placeholder);
    }

    var nav = document.querySelector('.crumbs');
    var template = this.crumbTemplate(parts);
    nav.innerHTML = template;
  },
  renderFooter: function() {
    var childrenCount, completedChildrenCount, activeChildrenCount, selectedParent;

    function countByCondition(parent, count, predicate) {
      var children = parent.children;
      for (var i = 0; i < children.length; i++) {
        var child = children[i];
        if (predicate(child)) {
          count++;
        }
        count = countByCondition(child, count, predicate);
      }
      return count;
    }
    
    selectedParent = this.getTodo(this.focusedTodoId);
    childrenCount = countByCondition(selectedParent, 0, function() {
      return true; 
    });
    completedChildrenCount = countByCondition(selectedParent, 0, function(todo) {
      return todo.completed;
    });
    activeChildrenCount = childrenCount - completedChildrenCount;

    var template = this.footerTemplate({
      activeTodoCount: activeChildrenCount,
      activeTodoWord: util.pluralize(activeChildrenCount, 'item'),
      completedTodos: completedChildrenCount,
      filter: this.filter,
      parentId: this.focusedTodoId
    });

    var footer = document.querySelector('#footer');

    // Hides footer if no todos
    footer.style.display = childrenCount > 0 ? 'block' : 'none';
    footer.innerHTML = template;
  },
  toggleAll: function(e) {
    var isChecked = e.target.checked;
    var todo = this.getTodo(this.focusedTodoId);

    function deepToggleAll(todo) {
      todo.completed = isChecked;
      if (todo.children.length > 0) {
        todo.children.forEach(function(child) {
          deepToggleAll(child);
        });
      }
    }

    deepToggleAll(todo);
    this.render();
  },
  getActiveTodos: function(todos) {
    // Helper function.
    // If any todo (or any nested child todo) is not completed, return true.
    // Otherwise, return false.
    function hasAnyActiveTodo(todos) {
      for (var i = 0; i < todos.length; i++) {
        var todo = todos[i];
        if (!todo.completed) {
          return true;
        }
        if (todo.children.length > 0) {
          return hasAnyActiveTodo(todo.children);
        }
      }

      return false;
    }

    return todos.filter(function(todo) {
      // If no children and uncompleted, keep it.
      if (todo.children.length === 0) {
        return !todo.completed;
      }
      // If any uncompleted nested todo, keep parent, neither it's completed or not.
      return hasAnyActiveTodo(todo.children);
    });
  },
  getCompletedTodos: function(todos) {
    // Helper function.
    // Returns true if any todo (or any nested child todo) is completed.
    // Otherwise, returns false.
    function hasAnyCompletedTodo(todos) {
      for (var i = 0; i < todos.length; i++) {
        var todo = todos[i];
        if (todo.completed) {
          return true;
        }
        if (todo.children.length > 0) {
          return hasAnyCompletedTodo(todo.children);
        }
      }

      return false;
    }

    return todos.filter(function(todo) {
      // If no children and completed, keep it.
      if (todo.children.length === 0) {
        return todo.completed;
      }
      // If any completed nested todo, keep parent, neither it's completed or not.
      return hasAnyCompletedTodo(todo.children);
    });
  },
  getFilteredTodos: function(todos) {
    if (this.filter === 'active') {
      return this.getActiveTodos(todos);
    }
    if (this.filter === 'completed') {
      return this.getCompletedTodos(todos);
    }
    return todos;
  },
  destroyCompleted: function() {
    // Helper function.
    // Travers through all nested todos, and filters out all completed todos.
    function travers(todo) {
      todo.children = this.getActiveTodos(todo.children);
      if (todo.children.length === 0) {
        return;
      }
      todo.children.forEach(function(child) {
        travers.call(this, child);
      }, this);
    }

    var root = this.getTodo('root');
    travers.bind(this)(root);

    this.focusedTodoId = 'root';
    this.filter = 'all';
    util.setHash('#/root/all');
    this.render();
  },
  create: function(e) {
    var inputElement = e.target;
    var val = inputElement.value.trim();

    if (e.which !== ENTER_KEY || !val) {
      return;
    }

    var parent = this.getTodo(this.focusedTodoId);
    parent.children.push({
      id: util.uuid(),
      title: val,
      completed: false,
      expanded: false,
      children: [],
      parentId: parent.id
    });

    inputElement.value = '';

    this.render();
  },
  toggle: function(e) {
    var id = e.target.closest('li').dataset.id;
    var todo = this.getTodo(id);
    var completed = !todo.completed;

    // Toggle all children todos
    function deepToggle(todo) {
      todo.completed = completed;
      if (todo.children.length > 0) {
        todo.children.forEach(function(child) {
          deepToggle(child);
        });
      }
    }

    deepToggle(todo);
    this.render();
  },
  expand: function(e) {
    var id = e.target.closest('li').dataset.id;
    var todo = this.getTodo(id);
    todo.expanded = !todo.expanded;
    this.render();
  },
  edit: function(e) {
    var targetElement = e.target;
    var closestLiElement = targetElement.closest('li');
    var inputElement = closestLiElement.querySelector('.edit');
    closestLiElement.className = 'editing';
    inputElement.focus();
  },
  editKeyup: function(e) {
    if (e.which === ENTER_KEY) {
      e.target.blur();
    }

    if (e.which === ESCAPE_KEY) {
      e.target.setAttribute('abort', true);
      e.target.blur();
    }
  },
  update: function(e) {
    var el = e.target;
    var id = e.target.closest('li').dataset.id;
    var todo = this.getTodo(id);
    var val = el.value.trim();

    if (!val) {
      this.destroy(e);
      return;
    }

    if (el.getAttribute('abort')) {
      el.setAttribute('abort', false);
    } else {
      todo.title = val;
    }

    this.render();
  },
  destroy: function(e) {
    var id = e.target.closest('li').dataset.id;
    var todo = this.getTodo(id);
    var parent = this.getTodo(todo.parentId);
    var todos = parent.children;
    todos.splice(this.indexFromId(todos, id), 1);
    this.render();
  },

  // Helper methods
  // Gets todo by id
  getTodo: function(id) {
    var result;

    function findTodo(root) {
      if (root.id === id) {
        result = root;
      } else {
        root.children.forEach(function(child) {
          findTodo(child);
        });
      }
    }

    findTodo(this.nestedTodos);
    return result;
  },

  // Get todo's index in parent.children array by id
  indexFromId: function(todos, id) {
    var i = todos.length;

    while (i--) {
      if (todos[i].id === id) {
        return i;
      }
    }
  }
};

App.init();