require 'strscan'

module JsDuck

  # Tokenizes JavaScript code into lexical tokens.
  #
  # Each token has a type and value.
  # Types and possible values for them are as follows:
  #
  # - :number      -- 25
  # - :string      -- "Hello world"
  # - :keyword     -- "typeof"
  # - :ident       -- "foo"
  # - :regex       -- "/abc/i"
  # - :operator    -- "+"
  # - :doc_comment -- "/** My comment */"
  #
  # Notice that doc-comments are recognized as tokens while normal
  # comments are ignored just as whitespace.
  #
  class Lexer
    def initialize(input)
      @input = input.is_a?(StringScanner) ? input : StringScanner.new(input)
      @tokens = []
    end

    # Tests if given pattern matches the tokens that follow at current
    # position.
    #
    # Takes list of strings and symbols.  Symbols are compared to
    # token type, while strings to token value.  For example:
    #
    #     look(:ident, "=", :regex)
    #
    def look(*tokens)
      pos = @input.pos
      buffered = 0
      ok = tokens.all? do |t|
        tok = next_token
        if tok
          @tokens << tok
          buffered += 1
        end
        if tok == nil
          false
        elsif t.instance_of?(Symbol)
          tok[:type] == t
        else
          tok[:value] == t
        end
      end
      @input.pos = pos
      @tokens.pop(buffered)
      return ok
    end

    # Returns the value of next token, moving the current token cursor
    # also to next token.
    #
    # When full=true, returns full token as hash like so:
    #
    #     {:type => :ident, :value => "foo"}
    #
    # For doc-comments the full token also contains the field :linenr,
    # pointing to the line where the doc-comment began.
    #
    def next(full=false)
      @tokens << tok = next_token
      full ? tok : tok[:value]
    end

    # True when no more tokens.
    def empty?
      pos = @input.pos
      tok = next_token
      @input.pos = pos
      return !tok
    end

    # Parses out next token from input stream.
    #
    # For efficency we look for tokens in order of frequency in
    # JavaScript source code:
    #
    # - first check for most common operators.
    # - then for identifiers and keywords.
    # - then strings
    # - then comments
    #
    # The remaining token types are less frequent, so these are left
    # to the end.
    #
    def next_token
      while !@input.eos? do
        skip_white
        if @input.check(/[.(),;={}:]/)
          return {
            :type => :operator,
            :value => @input.scan(/./)
          }
        elsif @input.check(/[a-zA-Z_]/)
          value = @input.scan(/\w+/)
          return {
            :type => KEYWORDS[value] ? :keyword : :ident,
            :value => value
          }
        elsif @input.check(/'/)
          return {
            :type => :string,
            :value => @input.scan(/'([^'\\]|\\.)*'/).sub(/^'(.*)'$/, "\\1")
          }
        elsif @input.check(/"/)
          return {
            :type => :string,
            :value => @input.scan(/"([^"\\]|\\.)*"/).sub(/^"(.*)"$/, "\\1")
          }
        elsif @input.check(/\//)
          # Several things begin with dash:
          # - comments, regexes, division-operators
          if @input.check(/\/\*\*/)
            return {
              :type => :doc_comment,
              # Calculate current line number, starting with 1
              :linenr => @input.string[0...@input.pos].count("\n") + 1,
              :value => @input.scan_until(/\*\/|\Z/)
            }
          elsif @input.check(/\/\*/)
            # skip multiline comment
            @input.scan_until(/\*\/|\Z/)
          elsif @input.check(/\/\//)
            # skip line comment
            @input.scan_until(/\n|\Z/)
          elsif regex?
            return {
              :type => :regex,
              :value => @input.scan(/\/([^\/\\]|\\.)*\/[gim]*/)
            }
          else
            return {
              :type => :operator,
              :value => @input.scan(/\//)
            }
          end
        elsif @input.check(/[0-9]+/)
          nr = @input.scan(/[0-9]+(\.[0-9]*)?/)
          return {
            :type => :number,
            :value => nr
          }
        elsif @input.check(/\$/)
          value = @input.scan(/\$\w*/)
          return {
            :type => :ident,
            :value => value
          }
        elsif  @input.check(/./)
          return {
            :type => :operator,
            :value => @input.scan(/./)
          }
        end
      end
    end

    # A slash "/" is a division operator if it follows:
    # - identifier
    # - the "this" keyword
    # - number
    # - closing bracket )
    # - closing square-bracket ]
    # Otherwise it's a beginning of regex
    def regex?
      if @tokens.last
        type = @tokens.last[:type]
        value = @tokens.last[:value]
        if type == :ident || type == :number
          return false
        elsif type == :keyword && value == "this"
          return false
        elsif type == :operator && (value == ")" || value == "]")
          return false
        end
      end
      return true
    end

    def skip_white
      @input.scan(/\s+/)
    end

    KEYWORDS = {
      "break" => true,
      "case" => true,
      "catch" => true,
      "continue" => true,
      "default" => true,
      "delete" => true,
      "do" => true,
      "else" => true,
      "finally" => true,
      "for" => true,
      "function" => true,
      "if" => true,
      "in" => true,
      "instanceof" => true,
      "new" => true,
      "return" => true,
      "switch" => true,
      "this" => true,
      "throw" => true,
      "try" => true,
      "typeof" => true,
      "var" => true,
      "void" => true,
      "while" => true,
      "with" => true,
    }
  end

end
